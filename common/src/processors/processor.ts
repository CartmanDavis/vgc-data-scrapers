import { logger } from '@vgc/common/logging';
import type { IDataStore } from '../database/interfaces.js';
import { validatePokemon } from './validate.js';

export interface ProcessorOptions {
  source?: string;
  tournamentIds?: string[];
  force?: boolean;
}

export class DataProcessor {
  private db: IDataStore;

  constructor(db: IDataStore) {
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
      processedTournamentIds: [],
      errors: [],
    };

    if (source !== 'limitless') {
      results.success = false;
      (results.errors as string[]).push(`Unsupported source: ${source}`);
      return results;
    }

    const rawDataRows = await this.db.getRawData(tournamentIds);
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

        if (!force && await this.db.isTournamentProcessed(tournamentId)) {
          logger.info({ id: tournamentId }, 'Tournament already processed, skipping');
          continue;
        }

        await this.processTournament(tournamentId, details, standings, pairings, results);
        results.tournamentsProcessed = (results.tournamentsProcessed as number) + 1;
        (results.processedTournamentIds as string[]).push(tournamentId);
        logger.info({ id: tournamentId }, 'Processed tournament');
      } catch (error) {
        const errorMsg = `Failed to process tournament ${tournamentId}: ${String(error)}`;
        logger.error({ error: String(error), tournamentId }, errorMsg);
        (results.errors as string[]).push(errorMsg);
      }
    }

    return results;
  }

  private async processTournament(
    tournamentId: string,
    details: Record<string, unknown>,
    standings: Array<Record<string, unknown>>,
    pairings: Array<Record<string, unknown>>,
    results: Record<string, unknown>,
  ): Promise<void> {
    const tournamentName = (details.name as string) || '';
    const tournamentDate = (details.date as string) || '';
    const generation = 9;
    const formatVal = (details.format as string) || '';
    const official = false;

    await this.db.upsertTournament({
      id: tournamentId,
      name: tournamentName,
      date: tournamentDate,
      location: null,
      generation,
      format: formatVal,
      official,
    });

    const playerNamesToIds: Record<string, number> = {};

    for (const standing of standings) {
      const playerName = (standing.name as string) || '';
      const country = standing.country as string | undefined;

      if (!playerName) continue;

      const alreadyKnown = playerName.toLowerCase() in playerNamesToIds;
      const playerId = await this.db.findOrCreatePlayer(playerName, country);
      playerNamesToIds[playerName.toLowerCase()] = playerId;
      if (!alreadyKnown) {
        results.playersAdded = (results.playersAdded as number) + 1;
      }

      const teamId = await this.db.findOrCreateTeam(playerId, tournamentId);
      results.teamsAdded = (results.teamsAdded as number) + 1;

      const placing = standing.placing as number | undefined;
      const record = (standing.record as Record<string, number>) || {};
      const wins = record.wins || 0;
      const losses = record.losses || 0;
      const ties = record.ties || 0;
      const dropped = !!standing.drop;

      await this.db.upsertStanding({
        tournamentId,
        playerId,
        teamId,
        placing: placing ?? null,
        wins,
        losses,
        ties,
        dropped,
      });
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

        const pokemonSetId = await this.db.insertPokemonSet({
          teamId,
          species: validated.species,
          item: validated.item,
          ability: validated.ability,
          tera_type: validated.tera_type,
          is_mega: validated.is_mega,
          invalid: validated.invalid,
        });
        results.pokemonSetsAdded = (results.pokemonSetsAdded as number) + 1;

        for (const move of validated.moves) {
          await this.db.insertMove(pokemonSetId, move);
        }
      }
    }

    for (const pairing of pairings) {
      const roundNumber = (pairing.round as number) || 0;
      const phase = (pairing.phase as number) || 1;
      const tableNumber = pairing.table as number | undefined;

      const matchId = await this.db.insertMatch({
        tournamentId,
        roundNumber,
        tableNumber: tableNumber ?? null,
        phase,
      });
      results.matchesAdded = (results.matchesAdded as number) + 1;

      const player1Name = pairing.player1 as string;
      const player2Name = pairing.player2 as string;
      const winner = pairing.winner as string;
      const winnerLower = winner?.toLowerCase() ?? '';

      if (player1Name) {
        const player1Id = playerNamesToIds[player1Name.toLowerCase()];
        if (player1Id) {
          const team1Id = await this.db.findOrCreateTeam(player1Id, tournamentId);
          await this.db.upsertMatchParticipant({
            matchId,
            playerId: player1Id,
            teamId: team1Id,
            score: winnerLower === player1Name.toLowerCase() ? 1 : 0,
          });
        }
      }

      if (player2Name) {
        const player2Id = playerNamesToIds[player2Name.toLowerCase()];
        if (player2Id) {
          const team2Id = await this.db.findOrCreateTeam(player2Id, tournamentId);
          await this.db.upsertMatchParticipant({
            matchId,
            playerId: player2Id,
            teamId: team2Id,
            score: winnerLower === player2Name.toLowerCase() ? 1 : 0,
          });
        }
      }
    }
  }
}
