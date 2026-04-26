import { logger } from '@vgc/common/logging';
import type { IDB } from '../database/db.js';
import { validatePokemon } from './validate.js';

export interface ProcessorOptions {
  source?: string;
  tournamentIds?: string[];
  force?: boolean;
}

export class DataProcessor {
  private db: IDB;

  constructor(db: IDB) {
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

    if (source !== 'limitless') {
      results.success = false;
      (results.errors as string[]).push(`Unsupported source: ${source}`);
      return results;
    }

    let query = 'SELECT id, details, standings, pairings FROM limitless_api_raw_data';
    const params: string[] = [];

    if (tournamentIds && tournamentIds.length > 0) {
      query += ` WHERE id IN (${tournamentIds.map(() => '?').join(',')})`;
      params.push(...tournamentIds);
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

        if (details.game && details.game !== 'VGC') {
          logger.info({ id: tournamentId, game: details.game }, 'Skipping non-VGC tournament');
          continue;
        }

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

    const insertTournament = this.db.prepare(`
      INSERT OR REPLACE INTO tournaments (id, name, date, location, generation, format, official)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStanding = this.db.prepare(`
      INSERT OR REPLACE INTO tournament_standings (tournament_id, player_id, team_id, placing, wins, losses, ties, dropped)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPokemonSet = this.db.prepare(`
      INSERT INTO pokemon_sets (team_id, species, item, ability, tera_type, is_mega, invalid)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMove = this.db.prepare(`
      INSERT INTO moves (pokemon_set_id, move_name)
      VALUES (?, ?)
    `);
    const insertMatch = this.db.prepare(`
      INSERT INTO matches (tournament_id, round_number, table_number, phase)
      VALUES (?, ?, ?, ?)
    `);
    const insertParticipant = this.db.prepare(`
      INSERT OR REPLACE INTO match_participants (match_id, player_id, team_id, score)
      VALUES (?, ?, ?, ?)
    `);

    const createTeam = this.db.prepare(`
      INSERT OR IGNORE INTO teams (player_id, tournament_id) VALUES (?, ?)
    `);
    const getPlayer = this.db.prepare('SELECT id FROM players WHERE name = ?');
    const insertPlayer = this.db.prepare('INSERT INTO players (name, country) VALUES (?, ?)');
    const getTeam = this.db.prepare('SELECT id FROM teams WHERE player_id = ? AND tournament_id = ?');

    this.db.prepare('BEGIN TRANSACTION').run();
    try {
      insertTournament.run(tournamentId, tournamentName, tournamentDate, location, generation, formatVal, official);

      const playerNamesToIds: Record<string, number> = {};

      for (const standing of standings) {
        const playerName = (standing.name as string) || '';
        const country = standing.country as string | undefined;

        if (!playerName) {
          continue;
        }

        let playerId: number;
        const existingPlayer = getPlayer.get(playerName) as { id: number } | undefined;
        if (existingPlayer) {
          playerId = existingPlayer.id;
        } else {
          const result = insertPlayer.run(playerName, country ?? null);
          playerId = result.lastInsertRowid as number;
          results.playersAdded = (results.playersAdded as number) + 1;
        }
        playerNamesToIds[playerName.toLowerCase()] = playerId;

        createTeam.run(playerId, tournamentId);
        const teamResult = getTeam.get(playerId, tournamentId) as { id: number };
        const teamId = teamResult.id;
        results.teamsAdded = (results.teamsAdded as number) + 1;

        const placing = standing.placing as number | undefined;
        const record = (standing.record as Record<string, number>) || {};
        const wins = record.wins || 0;
        const losses = record.losses || 0;
        const ties = record.ties || 0;
        const dropped = standing.drop ? 1 : 0;

        insertStanding.run(tournamentId, playerId, teamId, placing ?? null, wins, losses, ties, dropped);
        results.tournamentStandingsAdded = (results.tournamentStandingsAdded as number) + 1;

        const decklist = (standing.decklist as Array<Record<string, unknown>>) || [];
        for (const pokemon of decklist) {
          const validated = validatePokemon({
            name: (pokemon.name as string) || '',
            item: pokemon.item as string | undefined,
            ability: pokemon.ability as string | undefined,
            tera: pokemon.tera as string | undefined,
            attacks: (pokemon.attacks as string[]) || [],
          });

          for (const fix of validated.fixes) {
            logger.debug({ tournamentId, playerName, fix }, 'Auto-fixed pokemon data');
          }
          for (const warning of validated.warnings) {
            logger.warn({ tournamentId, playerName, warning }, 'Unknown pokemon data');
          }

          const pokemonSetResult = insertPokemonSet.run(
            teamId,
            validated.species,
            validated.item,
            validated.ability,
            validated.tera_type,
            validated.is_mega ? 1 : 0,
            validated.invalid ? 1 : 0,
          );
          const pokemonSetId = pokemonSetResult.lastInsertRowid as number;
          results.pokemonSetsAdded = (results.pokemonSetsAdded as number) + 1;

          for (const move of validated.moves) {
            insertMove.run(pokemonSetId, move);
          }
        }
      }

      for (const pairing of pairings) {
        const roundNumber = (pairing.round as number) || 0;
        const phase = (pairing.phase as number) || 1;
        const tableNumber = pairing.table as number | undefined;

        const matchResult = insertMatch.run(tournamentId, roundNumber, tableNumber ?? null, phase);
        const matchId = matchResult.lastInsertRowid;
        results.matchesAdded = (results.matchesAdded as number) + 1;

        const player1Name = pairing.player1 as string;
        const player2Name = pairing.player2 as string;
        const winner = pairing.winner as string;

        if (player1Name) {
          const player1Id = playerNamesToIds[player1Name.toLowerCase()];
          if (player1Id) {
            const teamResult = getTeam.get(player1Id, tournamentId) as { id: number } | undefined;
            if (teamResult) {
              const score1 = winner === player1Name ? 1 : 0;
              insertParticipant.run(matchId, player1Id, teamResult.id, score1);
            }
          }
        }

        if (player2Name) {
          const player2Id = playerNamesToIds[player2Name.toLowerCase()];
          if (player2Id) {
            const teamResult = getTeam.get(player2Id, tournamentId) as { id: number } | undefined;
            if (teamResult) {
              const score2 = winner === player2Name ? 1 : 0;
              insertParticipant.run(matchId, player2Id, teamResult.id, score2);
            }
          }
        }
      }

      this.db.prepare('COMMIT').run();
    } catch (error) {
      this.db.prepare('ROLLBACK').run();
      throw error;
    }
  }

}
