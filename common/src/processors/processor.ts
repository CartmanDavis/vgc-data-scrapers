import { logger } from '@vgc/common/logging';
import { DB } from '../database/db.js';

export interface ProcessorOptions {
  source?: string;
  tournamentIds?: string[];
  force?: boolean;
}

export class DataProcessor {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  async processTournaments(options: ProcessorOptions = {}): Promise<Record<string, unknown>> {
    const source = options.source || 'limitless';
    const tournamentIds = options.tournamentIds;
    const force = options.force || false;

    const results: Record<string, unknown> = {
      success: true,
      tournamentsProcessed: 0,
      playersAdded: 0,
      teamsAdded: 0,
      pokemonSetsAdded: 0,
      matchesAdded: 0,
      tournamentStandingsAdded: 0,
      errors: [],
    };

    let query = 'SELECT id, details, standings, pairings FROM limitless_api_raw_data';
    const params: string[] = [];

    if (source === 'limitless') {
      if (tournamentIds && tournamentIds.length > 0) {
        query += ` WHERE id IN (${tournamentIds.map(() => '?').join(',')})`;
        params.push(...tournamentIds);
      }
    } else {
      results.success = false;
      (results.errors as string[]).push(`Unsupported source: ${source}`);
      return results;
    }

    const rawDataRows = this.db.prepare(query).all(...params) as Array<{
      id: string;
      details: string;
      standings: string;
      pairings: string;
    }>;

    logger.info({ count: rawDataRows.length }, 'Found raw tournaments');

    for (const row of rawDataRows) {
      const { id: tournamentId, details: detailsJson, standings: standingsJson, pairings: pairingsJson } = row;

      try {
        if (!detailsJson || !standingsJson || !pairingsJson) {
          logger.warn({ id: tournamentId }, 'Incomplete data for tournament');
          continue;
        }

        const details = JSON.parse(detailsJson);
        const standings = JSON.parse(standingsJson);
        const pairings = JSON.parse(pairingsJson);

        if (!force) {
          if (this.isProcessed(tournamentId)) {
            logger.info({ id: tournamentId }, 'Tournament already processed, skipping');
            continue;
          }
        }

        this.processTournament(tournamentId, details, standings, pairings, results);
        results.tournamentsProcessed = (results.tournamentsProcessed as number) + 1;

        logger.info({ id: tournamentId }, 'Processed tournament');
      } catch (error) {
        const errorMsg = `Failed to process tournament ${tournamentId}: ${String(error)}`;
        logger.error({ error: String(error), tournamentId }, errorMsg);
        (results.errors as string[]).push(errorMsg);
      }
    }

    return results;
  }

  private isProcessed(tournamentId: string): boolean {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM tournaments WHERE id = ?').get(tournamentId) as { count: number };
    return result.count > 0;
  }

  private processTournament(
    tournamentId: string,
    details: Record<string, unknown>,
    standings: Array<Record<string, unknown>>,
    pairings: Array<Record<string, unknown>>,
    results: Record<string, unknown>
  ): void {
    const tournamentName = (details.name as string) || '';
    const tournamentDate = (details.date as string) || '';
    const location = null;
    const generation = 9;
    const formatVal = (details.format as string) || '';
    const official = 0;

    this.db.prepare(`
      INSERT OR REPLACE INTO tournaments (id, name, date, location, generation, format, official)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tournamentId, tournamentName, tournamentDate, location, generation, formatVal, official);

    const playerNamesToIds: Record<string, number> = {};

    for (const standing of standings) {
      const playerName = (standing.name as string) || '';
      const country = standing.country as string | undefined;

      if (!playerName) {
        continue;
      }

      const playerId = this.getOrCreatePlayer(playerName, country);
      playerNamesToIds[playerName.toLowerCase()] = playerId;

      const teamId = this.getOrCreateTeam(playerId, tournamentId);

      const placing = standing.placing as number | undefined;
      const record = (standing.record as Record<string, number>) || {};
      const wins = record.wins || 0;
      const losses = record.losses || 0;
      const ties = record.ties || 0;
      const dropped = standing.drop ? 1 : 0;

      this.db.prepare(`
        INSERT OR REPLACE INTO tournament_standings (tournament_id, player_id, team_id, placing, wins, losses, ties, dropped)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tournamentId, playerId, teamId, placing ?? null, wins, losses, ties, dropped);

      results.tournamentStandingsAdded = (results.tournamentStandingsAdded as number) + 1;
      results.playersAdded = (results.playersAdded as number) + 1;
      results.teamsAdded = (results.teamsAdded as number) + 1;

      const decklist = (standing.decklist as Array<Record<string, unknown>>) || [];
      for (const pokemon of decklist) {
        const pokemonName = (pokemon.name as string) || '';
        const item = pokemon.item as string | undefined;
        const ability = pokemon.ability as string | undefined;
        const teraType = pokemon.tera as string | undefined;
        const attacks = (pokemon.attacks as string[]) || [];

        const pokemonSetId = this.createPokemonSet(teamId, pokemonName, item, ability, teraType);
        results.pokemonSetsAdded = (results.pokemonSetsAdded as number) + 1;

        for (const move of attacks) {
          this.db.prepare(`
            INSERT INTO moves (pokemon_set_id, move_name)
            VALUES (?, ?)
          `).run(pokemonSetId, move);
        }
      }
    }

    for (const pairing of pairings) {
      const roundNumber = (pairing.round as number) || 0;
      const phase = (pairing.phase as number) || 1;
      const tableNumber = pairing.table as number | undefined;

      const matchResult = this.db.prepare(`
        INSERT INTO matches (tournament_id, round_number, table_number, phase)
        VALUES (?, ?, ?, ?)
      `).run(tournamentId, roundNumber, tableNumber ?? null, phase);

      const matchId = matchResult.lastInsertRowid;
      results.matchesAdded = (results.matchesAdded as number) + 1;

      const player1Name = pairing.player1 as string;
      const player2Name = pairing.player2 as string;
      const winner = pairing.winner as string;

      if (player1Name) {
        const player1Id = playerNamesToIds[player1Name.toLowerCase()];
        if (player1Id) {
          const team1Id = this.getTeamId(player1Id, tournamentId);
          if (team1Id) {
            const score1 = winner === player1Name ? 1 : 0;
            this.db.prepare(`
              INSERT OR REPLACE INTO match_participants (match_id, player_id, team_id, score)
              VALUES (?, ?, ?, ?)
            `).run(matchId, player1Id, team1Id, score1);
          }
        }
      }

      if (player2Name) {
        const player2Id = playerNamesToIds[player2Name.toLowerCase()];
        if (player2Id) {
          const team2Id = this.getTeamId(player2Id, tournamentId);
          if (team2Id) {
            const score2 = winner === player2Name ? 1 : 0;
            this.db.prepare(`
              INSERT OR REPLACE INTO match_participants (match_id, player_id, team_id, score)
              VALUES (?, ?, ?, ?)
            `).run(matchId, player2Id, team2Id, score2);
          }
        }
      }
    }
  }

  private getOrCreatePlayer(name: string, country?: string): number {
    const existing = this.db.prepare('SELECT id FROM players WHERE name = ?').get(name) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }

    const result = this.db.prepare('INSERT INTO players (name, country) VALUES (?, ?)').run(name, country ?? null);
    return result.lastInsertRowid as number;
  }

  private getOrCreateTeam(playerId: number, tournamentId: string): number {
    const existing = this.db.prepare('SELECT id FROM teams WHERE player_id = ? AND tournament_id = ?').get(playerId, tournamentId) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }

    const result = this.db.prepare('INSERT INTO teams (player_id, tournament_id) VALUES (?, ?)').run(playerId, tournamentId);
    return result.lastInsertRowid as number;
  }

  private getTeamId(playerId: number, tournamentId: string): number | null {
    const result = this.db.prepare('SELECT id FROM teams WHERE player_id = ? AND tournament_id = ?').get(playerId, tournamentId) as { id: number } | undefined;
    return result?.id ?? null;
  }

  private createPokemonSet(teamId: number, species: string, item?: string, ability?: string, teraType?: string): number {
    const result = this.db.prepare(`
      INSERT INTO pokemon_sets (team_id, species, item, ability, tera_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(teamId, species, item ?? null, ability ?? null, teraType ?? null);
    return result.lastInsertRowid as number;
  }
}
