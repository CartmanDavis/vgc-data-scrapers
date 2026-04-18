import { runQuery } from './db';
import type {
  Tournament,
  Player,
  TeamWithPlayer,
  TeamWithPokemon,
  PokemonWithMoves,
  TournamentStandingWithPlayer,
  UsageStat,
  UsageStatByFormat,
  TrendData,
  PairStats,
} from '../types';

export function getTournaments(limit = 100): Tournament[] {
  return runQuery<Tournament>(`
    SELECT id, name, date, location, generation, format, official
    FROM tournaments
    ORDER BY date DESC
    LIMIT ?
  `, [limit]);
}

export function getTournamentsByFormat(format: string | null, limit = 100, offset = 0): Tournament[] {
  if (format === null || format === 'all') {
    return runQuery<Tournament>(`
      SELECT id, name, date, location, generation, format, official
      FROM tournaments
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
  }
  return runQuery<Tournament>(`
    SELECT id, name, date, location, generation, format, official
    FROM tournaments
    WHERE format = ?
    ORDER BY date DESC
    LIMIT ? OFFSET ?
  `, [format, limit, offset]);
}

export function getTournamentCountByFormat(format: string | null): number {
  if (format === null || format === 'all') {
    const results = runQuery<{ count: number }>(`
      SELECT COUNT(*) as count FROM tournaments
    `, []);
    return results[0]?.count || 0;
  }
  const results = runQuery<{ count: number }>(`
    SELECT COUNT(*) as count FROM tournaments WHERE format = ?
  `, [format]);
  return results[0]?.count || 0;
}

export function getTournamentById(id: string): Tournament | null {
  const results = runQuery<Tournament>(`
    SELECT id, name, date, location, generation, format, official
    FROM tournaments
    WHERE id = ?
  `, [id]);
  return results[0] || null;
}

export function getFormats(): string[] {
  const results = runQuery<{ format: string }>(`
    SELECT DISTINCT format FROM tournaments ORDER BY format
  `);
  return results.map(r => r.format);
}

export function getPlayerById(id: number): Player | null {
  const results = runQuery<Player>(`
    SELECT id, name, country
    FROM players
    WHERE id = ?
  `, [id]);
  return results[0] || null;
}

export function getPlayers(limit = 100): Player[] {
  return runQuery<Player>(`
    SELECT id, name, country
    FROM players
    ORDER BY name
    LIMIT ?
  `, [limit]);
}

export function searchPlayers(query: string, limit = 20): Player[] {
  return runQuery<Player>(`
    SELECT id, name, country
    FROM players
    WHERE name LIKE ?
    ORDER BY name
    LIMIT ?
  `, [`%${query}%`, limit]);
}

export function getTeamById(id: number): TeamWithPokemon | null {
  const teamResults = runQuery<TeamWithPlayer>(`
    SELECT t.id, t.player_id, t.tournament_id, p.name as player_name
    FROM teams t
    JOIN players p ON t.player_id = p.id
    WHERE t.id = ?
  `, [id]);
  
  if (!teamResults[0]) return null;
  
  const team = teamResults[0];
  const pokemon = getPokemonByTeamId(team.id);
  
  return { ...team, pokemon };
}

export function getPokemonByTeamId(teamId: number): PokemonWithMoves[] {
  const pokemonSets = runQuery<{
    id: number;
    team_id: number;
    species: string;
    form: string | null;
    item: string | null;
    ability: string | null;
    tera_type: string | null;
  }>(`
    SELECT id, team_id, species, form, item, ability, tera_type
    FROM pokemon_sets
    WHERE team_id = ?
  `, [teamId]);
  
  return pokemonSets.map(p => {
    const moves = runQuery<{ move_name: string }>(`
      SELECT move_name FROM moves WHERE pokemon_set_id = ?
    `, [p.id]).map(m => m.move_name);
    
    return { ...p, moves };
  });
}

export function getTeamsByTournament(tournamentId: string): TeamWithPlayer[] {
  return runQuery<TeamWithPlayer>(`
    SELECT t.id, t.player_id, t.tournament_id, p.name as player_name
    FROM teams t
    JOIN players p ON t.player_id = p.id
    WHERE t.tournament_id = ?
  `, [tournamentId]);
}

export function getStandingsByTournament(tournamentId: string): TournamentStandingWithPlayer[] {
  return runQuery<TournamentStandingWithPlayer>(`
    SELECT ts.id, ts.tournament_id, ts.player_id, ts.team_id, 
           ts.placing, ts.wins, ts.losses, ts.ties, ts.dropped,
           p.name as player_name
    FROM tournament_standings ts
    JOIN players p ON ts.player_id = p.id
    WHERE ts.tournament_id = ?
    ORDER BY ts.placing ASC
  `, [tournamentId]);
}

export function getPlayerTournaments(playerId: number): TournamentStandingWithPlayer[] {
  return runQuery<TournamentStandingWithPlayer>(`
    SELECT ts.id, ts.tournament_id, ts.player_id, ts.team_id,
           ts.placing, ts.wins, ts.losses, ts.ties, ts.dropped,
           p.name as player_name,
           t.name as tournament_name, t.date, t.format
    FROM tournament_standings ts
    JOIN tournaments t ON ts.tournament_id = t.id
    JOIN players p ON ts.player_id = p.id
    WHERE ts.player_id = ?
    ORDER BY t.date DESC
  `, [playerId]);
}

export function getPlayerTeams(playerId: number): TeamWithPokemon[] {
  const teams = runQuery<TeamWithPlayer>(`
    SELECT t.id, t.player_id, t.tournament_id, p.name as player_name
    FROM teams t
    JOIN players p ON t.player_id = p.id
    WHERE t.player_id = ?
  `, [playerId]);
  
  return teams.map(team => ({
    ...team,
    pokemon: getPokemonByTeamId(team.id),
  }));
}

export function getUsageStats(format?: string, limit = 50): UsageStat[] {
  let sql = `
    SELECT 
      ps.species,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
    FROM pokemon_sets ps
    JOIN teams t ON ps.team_id = t.id
    JOIN tournaments tr ON t.tournament_id = tr.id
  `;
  
  const params: unknown[] = [];
  if (format) {
    sql += ` WHERE tr.format = ?`;
    params.push(format);
  }
  
  sql += `
    GROUP BY ps.species
    ORDER BY count DESC
    LIMIT ?
  `;
  params.push(limit);
  
  return runQuery<UsageStat>(sql, params);
}

export function getUsageStatsByFormat(): UsageStatByFormat[] {
  const formats = getFormats();
  return formats.map(format => ({
    format,
    stats: getUsageStats(format),
  }));
}

export function getUsageTrend(species: string): TrendData[] {
  return runQuery<TrendData>(`
    SELECT 
      t.date,
      ROUND(COUNT(ps.id) * 100.0 / (
        SELECT COUNT(*) FROM pokemon_sets ps2 
        JOIN teams t2 ON ps2.team_id = t2.id 
        JOIN tournaments tr2 ON t2.tournament_id = tr2.id 
        WHERE tr2.date = t.date
      ), 2) as usage
    FROM pokemon_sets ps
    JOIN teams tm ON ps.team_id = tm.id
    JOIN tournaments t ON tm.tournament_id = t.id
    WHERE ps.species = ?
    GROUP BY t.date
    ORDER BY t.date ASC
  `, [species]);
}

export function getTopPairs(limit = 20): PairStats[] {
  return runQuery<{
    pokemon1: string;
    pokemon2: string;
    count: number;
    winRate: number;
  }>(`
    SELECT 
      ps1.species as pokemon1,
      ps2.species as pokemon2,
      COUNT(*) as count,
      0.0 as winRate
    FROM pokemon_sets ps1
    JOIN pokemon_sets ps2 ON ps1.team_id = ps2.team_id AND ps1.id < ps2.id
    JOIN teams t ON ps1.team_id = t.id
    JOIN tournament_standings ts ON t.id = ts.team_id
    GROUP BY ps1.species, ps2.species
    ORDER BY count DESC
    LIMIT ?
  `, [limit]).map(r => ({
    pokemon1: r.pokemon1,
    pokemon2: r.pokemon2,
    count: Number(r.count),
    winRate: Number(r.winRate),
  }));
}

export function getTournamentCount(): number {
  const results = runQuery<{ count: number }>(`
    SELECT COUNT(*) as count FROM tournaments
  `);
  return results[0]?.count || 0;
}

export function getPlayerCount(): number {
  const results = runQuery<{ count: number }>(`
    SELECT COUNT(*) as count FROM players
  `);
  return results[0]?.count || 0;
}
