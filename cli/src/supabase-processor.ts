import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@vgc/common/logging';
import { validatePokemon } from '@vgc/common/processors/validate';

export interface ProcessorOptions {
  source?: string;
  tournamentIds?: string[];
  force?: boolean;
}

export class SupabaseProcessor {
  constructor(private supabase: SupabaseClient) {}

  async processTournaments(options: ProcessorOptions = {}): Promise<Record<string, unknown>> {
    const { tournamentIds, force = false } = options;

    const results: Record<string, unknown> = {
      success: true,
      tournamentsProcessed: 0,
      playersAdded: 0,
      teamsAdded: 0,
      pokemonSetsAdded: 0,
      matchesAdded: 0,
      tournamentStandingsAdded: 0,
      processedTournamentIds: [],
      errors: [],
    };

    // Fetch raw data from Supabase
    let query = this.supabase
      .from('limitless_api_raw_data')
      .select('id, details, standings, pairings');
    if (tournamentIds?.length) {
      query = query.in('id', tournamentIds);
    }
    const { data: rawRows, error: fetchError } = await query;
    if (fetchError) {
      results.success = false;
      (results.errors as string[]).push(`Failed to fetch raw data: ${fetchError.message}`);
      return results;
    }

    logger.info({ count: rawRows?.length ?? 0 }, 'Found raw tournaments');

    for (const row of rawRows ?? []) {
      try {
        await this.processTournament(row.id, row.details, row.standings, row.pairings, force, results);
      } catch (error) {
        const msg = `Failed to process tournament ${row.id}: ${String(error)}`;
        logger.error({ error: String(error), tournamentId: row.id }, msg);
        (results.errors as string[]).push(msg);
      }
    }

    return results;
  }

  private async processTournament(
    tournamentId: string,
    details: Record<string, unknown>,
    standings: Array<Record<string, unknown>>,
    pairings: Array<Record<string, unknown>>,
    force: boolean,
    results: Record<string, unknown>,
  ): Promise<void> {
    if (details.game && details.game !== 'VGC') {
      logger.info({ tournamentId, game: details.game }, 'Skipping non-VGC tournament');
      return;
    }

    // Check if already processed
    if (!force) {
      const { data: existing } = await this.supabase
        .from('tournaments')
        .select('id')
        .eq('id', tournamentId)
        .maybeSingle();
      // A stub exists if the limitless command ran, but we check for a real record
      // by verifying teams exist (stub has no teams)
      if (existing) {
        const { count } = await this.supabase
          .from('teams')
          .select('id', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId);
        if ((count ?? 0) > 0) {
          logger.info({ tournamentId }, 'Tournament already processed, skipping');
          return;
        }
      }
    }

    // Force cleanup — delete in FK dependency order
    if (force) {
      await this.deleteTournamentData(tournamentId);
    }

    // Upsert tournament record
    const { error: tErr } = await this.supabase.from('tournaments').upsert({
      id: tournamentId,
      name: (details.name as string) || '',
      date: (details.date as string) || '',
      location: null,
      generation: 9,
      format: (details.format as string) || '',
      official: false,
    });
    if (tErr) throw new Error(`tournaments upsert: ${tErr.message}`);

    // ── Players ──────────────────────────────────────────────────────────────
    const validStandings = standings.filter(s => s.name);
    const playerNames = validStandings.map(s => s.name as string);

    const { data: existingPlayers, error: pErr } = await this.supabase
      .from('players')
      .select('id, name')
      .in('name', playerNames);
    if (pErr) throw new Error(`players select: ${pErr.message}`);

    const nameToId = new Map<string, number>(
      (existingPlayers ?? []).map(p => [p.name.toLowerCase(), p.id]),
    );

    const missingStandings = validStandings.filter(s => !nameToId.has((s.name as string).toLowerCase()));
    if (missingStandings.length) {
      const { data: newPlayers, error: piErr } = await this.supabase
        .from('players')
        .insert(missingStandings.map(s => ({ name: s.name as string, country: (s.country as string) ?? null })))
        .select('id, name');
      if (piErr) throw new Error(`players insert: ${piErr.message}`);
      (newPlayers ?? []).forEach(p => nameToId.set(p.name.toLowerCase(), p.id));
      results.playersAdded = (results.playersAdded as number) + (newPlayers?.length ?? 0);
    }

    // ── Teams ─────────────────────────────────────────────────────────────────
    const { data: existingTeams, error: etErr } = await this.supabase
      .from('teams')
      .select('id, player_id')
      .eq('tournament_id', tournamentId);
    if (etErr) throw new Error(`teams select: ${etErr.message}`);

    const playerIdToTeamId = new Map<number, number>(
      (existingTeams ?? []).map(t => [t.player_id, t.id]),
    );

    const teamsToInsert = validStandings
      .map(s => ({ player_id: nameToId.get((s.name as string).toLowerCase())!, tournament_id: tournamentId }))
      .filter(t => t.player_id && !playerIdToTeamId.has(t.player_id));

    if (teamsToInsert.length) {
      const { data: newTeams, error: tiErr } = await this.supabase
        .from('teams')
        .insert(teamsToInsert)
        .select('id, player_id');
      if (tiErr) throw new Error(`teams insert: ${tiErr.message}`);
      (newTeams ?? []).forEach(t => playerIdToTeamId.set(t.player_id, t.id));
      results.teamsAdded = (results.teamsAdded as number) + (newTeams?.length ?? 0);
    }

    // ── Tournament standings ───────────────────────────────────────────────
    const standingsRows = validStandings
      .map(s => {
        const playerId = nameToId.get((s.name as string).toLowerCase());
        const teamId = playerId ? playerIdToTeamId.get(playerId) : undefined;
        if (!playerId || !teamId) return null;
        const record = (s.record as Record<string, number>) || {};
        return {
          tournament_id: tournamentId,
          player_id: playerId,
          team_id: teamId,
          placing: (s.placing as number) ?? null,
          wins: record.wins ?? 0,
          losses: record.losses ?? 0,
          ties: record.ties ?? 0,
          dropped: Boolean(s.drop),
        };
      })
      .filter(Boolean);

    if (standingsRows.length) {
      const { error: sErr } = await this.supabase
        .from('tournament_standings')
        .upsert(standingsRows, { onConflict: 'tournament_id,player_id' });
      if (sErr) throw new Error(`tournament_standings upsert: ${sErr.message}`);
      results.tournamentStandingsAdded = (results.tournamentStandingsAdded as number) + standingsRows.length;
    }

    // ── Pokemon sets + moves (per team) ───────────────────────────────────
    for (const standing of validStandings) {
      const playerId = nameToId.get((standing.name as string).toLowerCase());
      const teamId = playerId ? playerIdToTeamId.get(playerId) : undefined;
      if (!teamId) continue;

      const decklist = (standing.decklist as Array<Record<string, unknown>>) || [];
      if (!decklist.length) continue;

      const validated = decklist.map(p =>
        validatePokemon({
          name: (p.name as string) || '',
          item: p.item as string | undefined,
          ability: p.ability as string | undefined,
          tera: p.tera as string | undefined,
          attacks: (p.attacks as string[]) || [],
        }),
      );

      const { data: sets, error: psErr } = await this.supabase
        .from('pokemon_sets')
        .insert(validated.map(v => ({
          team_id: teamId,
          species: v.species,
          form: null,
          item: v.item,
          ability: v.ability,
          tera_type: v.tera_type,
          is_mega: v.is_mega,
          invalid: v.invalid,
        })))
        .select('id');
      if (psErr) throw new Error(`pokemon_sets insert: ${psErr.message}`);
      results.pokemonSetsAdded = (results.pokemonSetsAdded as number) + (sets?.length ?? 0);

      const allMoves = (sets ?? []).flatMap((set, i) =>
        validated[i].moves.map(move => ({ pokemon_set_id: set.id, move_name: move })),
      );
      if (allMoves.length) {
        const { error: mErr } = await this.supabase.from('moves').insert(allMoves);
        if (mErr) throw new Error(`moves insert: ${mErr.message}`);
      }
    }

    // ── Matches + participants ─────────────────────────────────────────────
    if (pairings.length) {
      const { data: insertedMatches, error: matchErr } = await this.supabase
        .from('matches')
        .insert(pairings.map(p => ({
          tournament_id: tournamentId,
          round_number: (p.round as number) || 0,
          table_number: (p.table as number) ?? null,
          phase: (p.phase as number) ?? 1,
        })))
        .select('id');
      if (matchErr) throw new Error(`matches insert: ${matchErr.message}`);
      results.matchesAdded = (results.matchesAdded as number) + (insertedMatches?.length ?? 0);

      const participants: Array<Record<string, unknown>> = [];
      (insertedMatches ?? []).forEach((match, i) => {
        const pairing = pairings[i];
        const winner = pairing.winner as string;
        for (const playerName of [pairing.player1 as string, pairing.player2 as string]) {
          if (!playerName) continue;
          const playerId = nameToId.get(playerName.toLowerCase());
          const teamId = playerId ? playerIdToTeamId.get(playerId) : undefined;
          if (playerId && teamId) {
            participants.push({ match_id: match.id, player_id: playerId, team_id: teamId, score: winner === playerName ? 1 : 0 });
          }
        }
      });

      if (participants.length) {
        const { error: partErr } = await this.supabase
          .from('match_participants')
          .upsert(participants, { onConflict: 'match_id,player_id' });
        if (partErr) throw new Error(`match_participants upsert: ${partErr.message}`);
      }
    }

    results.tournamentsProcessed = (results.tournamentsProcessed as number) + 1;
    (results.processedTournamentIds as string[]).push(tournamentId);
    logger.info({ tournamentId }, 'Processed tournament');
  }

  private async deleteTournamentData(tournamentId: string): Promise<void> {
    // Fetch match IDs
    const { data: matches } = await this.supabase.from('matches').select('id').eq('tournament_id', tournamentId);
    const matchIds = (matches ?? []).map(m => m.id);
    if (matchIds.length) {
      await this.supabase.from('match_participants').delete().in('match_id', matchIds);
      await this.supabase.from('matches').delete().in('id', matchIds);
    }

    // Fetch team IDs
    const { data: teams } = await this.supabase.from('teams').select('id').eq('tournament_id', tournamentId);
    const teamIds = (teams ?? []).map(t => t.id);
    if (teamIds.length) {
      const { data: psets } = await this.supabase.from('pokemon_sets').select('id').in('team_id', teamIds);
      const psIds = (psets ?? []).map(p => p.id);
      if (psIds.length) {
        await this.supabase.from('moves').delete().in('pokemon_set_id', psIds);
        await this.supabase.from('pokemon_sets').delete().in('id', psIds);
      }
    }

    await this.supabase.from('tournament_standings').delete().eq('tournament_id', tournamentId);
    if (teamIds.length) {
      await this.supabase.from('teams').delete().in('id', teamIds);
    }
  }
}
