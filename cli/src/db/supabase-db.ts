import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  IDataStore,
  RawDataRow,
  TournamentData,
  PokemonSetData,
  MatchData,
  MatchParticipantData,
  StandingData,
} from '@vgc/common/database/interfaces';

export class SupabaseDataStore implements IDataStore {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async ensureTournamentStub(id: string, name: string, date: string, format: string, generation: number): Promise<void> {
    const { error } = await this.client
      .from('tournaments')
      .upsert({ id, name, date, format, generation, official: false }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`ensureTournamentStub: ${error.message}`);
  }

  async rawDataExists(id: string): Promise<boolean> {
    const { data } = await this.client
      .from('limitless_api_raw_data')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    return data !== null;
  }

  async storeRawData(id: string, details: unknown, standings: unknown, pairings: unknown): Promise<void> {
    const { error } = await this.client
      .from('limitless_api_raw_data')
      .upsert({ id, details, standings, pairings }, { onConflict: 'id' });
    if (error) throw new Error(`storeRawData: ${error.message}`);
  }

  async getRawData(tournamentIds?: string[]): Promise<RawDataRow[]> {
    let query = this.client
      .from('limitless_api_raw_data')
      .select('id, details, standings, pairings');
    if (tournamentIds && tournamentIds.length > 0) {
      query = query.in('id', tournamentIds);
    }
    const { data, error } = await query;
    if (error) throw new Error(`getRawData: ${error.message}`);
    return (data ?? []).map(row => ({
      id: row.id,
      details: JSON.stringify(row.details),
      standings: JSON.stringify(row.standings),
      pairings: JSON.stringify(row.pairings),
    }));
  }

  // A tournament is fully processed when it has standings records.
  // (The scraper inserts a stub into tournaments before raw data, so checking
  // tournaments alone isn't enough to know if processing is done.)
  async isTournamentProcessed(id: string): Promise<boolean> {
    const { count } = await this.client
      .from('tournament_standings')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id);
    return (count ?? 0) > 0;
  }

  async tournamentExists(id: string): Promise<boolean> {
    const { data } = await this.client
      .from('tournaments')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    return data !== null;
  }

  async upsertTournament(t: TournamentData): Promise<void> {
    const { error } = await this.client
      .from('tournaments')
      .upsert({
        id: t.id,
        name: t.name,
        date: t.date,
        location: t.location ?? null,
        generation: t.generation,
        format: t.format,
        official: t.official,
      }, { onConflict: 'id' });
    if (error) throw new Error(`upsertTournament: ${error.message}`);
  }

  async findOrCreatePlayer(name: string, country?: string): Promise<number> {
    const { data: existing } = await this.client
      .from('players')
      .select('id')
      .ilike('name', name)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await this.client
      .from('players')
      .insert({ name, country: country ?? null })
      .select('id')
      .single();
    if (error) throw new Error(`findOrCreatePlayer: ${error.message}`);
    return data.id;
  }

  async findOrCreateTeam(playerId: number, tournamentId: string): Promise<number> {
    const { data: existing } = await this.client
      .from('teams')
      .select('id')
      .eq('player_id', playerId)
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await this.client
      .from('teams')
      .insert({ player_id: playerId, tournament_id: tournamentId })
      .select('id')
      .single();

    if (!error) return data.id;

    // Unique violation: inserted concurrently, fetch the existing row
    if (error.code === '23505') {
      const { data: row } = await this.client
        .from('teams')
        .select('id')
        .eq('player_id', playerId)
        .eq('tournament_id', tournamentId)
        .single();
      return row!.id;
    }

    throw new Error(`findOrCreateTeam: ${error.message}`);
  }

  async insertPokemonSet(data: PokemonSetData): Promise<number> {
    const { data: row, error } = await this.client
      .from('pokemon_sets')
      .insert({
        team_id: data.teamId,
        species: data.species,
        item: data.item ?? null,
        ability: data.ability ?? null,
        tera_type: data.tera_type ?? null,
        is_mega: data.is_mega,
        invalid: data.invalid,
      })
      .select('id')
      .single();
    if (error) throw new Error(`insertPokemonSet: ${error.message}`);
    return row.id;
  }

  async insertMove(pokemonSetId: number, moveName: string): Promise<void> {
    const { error } = await this.client
      .from('moves')
      .insert({ pokemon_set_id: pokemonSetId, move_name: moveName });
    if (error) throw new Error(`insertMove: ${error.message}`);
  }

  async insertMatch(data: MatchData): Promise<number> {
    const { data: row, error } = await this.client
      .from('matches')
      .insert({
        tournament_id: data.tournamentId,
        round_number: data.roundNumber,
        table_number: data.tableNumber ?? null,
        phase: data.phase ?? null,
      })
      .select('id')
      .single();
    if (error) throw new Error(`insertMatch: ${error.message}`);
    return row.id;
  }

  async upsertMatchParticipant(data: MatchParticipantData): Promise<void> {
    const { error } = await this.client
      .from('match_participants')
      .upsert({
        match_id: data.matchId,
        player_id: data.playerId,
        team_id: data.teamId,
        score: data.score,
      }, { onConflict: 'match_id,player_id' });
    if (error) throw new Error(`upsertMatchParticipant: ${error.message}`);
  }

  async upsertStanding(data: StandingData): Promise<void> {
    const { error } = await this.client
      .from('tournament_standings')
      .upsert({
        tournament_id: data.tournamentId,
        player_id: data.playerId,
        team_id: data.teamId,
        placing: data.placing ?? null,
        wins: data.wins,
        losses: data.losses,
        ties: data.ties,
        dropped: data.dropped,
      }, { onConflict: 'tournament_id,player_id' });
    if (error) throw new Error(`upsertStanding: ${error.message}`);
  }

  close(): void {
    // No-op for Supabase
  }
}
