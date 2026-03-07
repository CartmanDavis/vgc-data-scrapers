import { BaseScraper } from './base.js';
import { logger } from '@vgc/common/logging.js';
import { DB } from '../database/db.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface RK9ScraperOptions {
  requestDelay?: number;
}

export class RK9Scraper extends BaseScraper {
  private requestDelay: number;

  constructor(db: DB, options: RK9ScraperOptions = {}) {
    super(db);
    this.requestDelay = options.requestDelay || 1.0;
  }

  async scrape(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const tournamentUrl = params.url as string | undefined;
    if (!tournamentUrl) {
      logger.error('RK9 tournament URL not provided');
      return { success: false, error: 'URL required' };
    }

    await this.waitForRateLimit();

    try {
      logger.info('Scraping RK9 tournament: url=%s', tournamentUrl);

      const tournamentData = await this.scrapeTournamentPage(tournamentUrl);
      if (!tournamentData) {
        logger.error('Failed to scrape tournament page');
        return { success: false, error: 'Failed to scrape tournament page' };
      }

      const tournamentId = (tournamentData.id && typeof tournamentData.id === 'string') 
        ? tournamentData.id 
        : this.generateTournamentId(tournamentUrl);

      if (this.tournamentExists(tournamentId)) {
        logger.info('Tournament already exists, skipping: id=%s', tournamentId);
        return { success: true, skipped: true, tournament_id: tournamentId };
      }

      this.saveTournament(tournamentId, tournamentData);

      const rosterUrl = tournamentUrl.replace(/\/$/, '') + '/roster/';
      await this.waitForRateLimit();
      await this.scrapeRoster(rosterUrl, tournamentId);

      const pairingsUrl = tournamentUrl.replace(/\/$/, '') + '/pairings/';
      await this.waitForRateLimit();
      await this.scrapePairings(pairingsUrl, tournamentId);

      logger.info('Successfully scraped RK9 tournament: id=%s', tournamentId);

      return {
        success: true,
        tournament_id: tournamentId,
      };
    } catch (error) {
      logger.error('Error scraping RK9 tournament: url=%s error=%s', tournamentUrl, String(error));
      return { success: false, error: String(error) };
    }
  }

  private async waitForRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.requestDelay * 1000));
  }

  private generateTournamentId(url: string): string {
    return `rk9-${url.replace(/\/$/, '').split('/').pop()}`;
  }

  private async scrapeTournamentPage(url: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      let name: string | null = null;
      let date: string | null = null;
      let location: string | null = null;
      const formatStr = 'reg f';

      const nameElem = $('h1').first();
      if (nameElem.length) {
        name = nameElem.text().trim();
      }

      $('*').each((_, elem) => {
        const text = $(elem).contents().filter((_, n) => n.type === 'text').text();
        if (text && text.includes('Date:')) {
          date = text.replace('Date:', '').trim();
        }
        if (text && text.includes('Location:')) {
          location = text.replace('Location:', '').trim();
        }
      });

      if (!name) {
        return null;
      }

      const { generation, format } = this.parseFormat(formatStr);

      return {
        name,
        date,
        location,
        generation,
        format,
      };
    } catch (error) {
      logger.error({ error: String(error), url }, 'Error parsing tournament page');
      return null;
    }
  }

  private async scrapeRoster(url: string, tournamentId: string): Promise<void> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const playerEntries = $('div[class*="player"]');

      for (let i = 0; i < playerEntries.length; i++) {
        const entry = $(playerEntries[i]);
        let playerName: string | null = null;
        let country: string | undefined;
        const pokemonList: string[] = [];

        const nameElem = entry.find('[class*="name"]').first();
        if (nameElem.length) {
          const nameText = nameElem.text().trim();
          const parenIdx = nameText.lastIndexOf('(');
          if (parenIdx !== -1 && nameText.includes(')')) {
            playerName = nameText.substring(0, parenIdx).trim();
            country = nameText.substring(parenIdx + 1).replace(')', '').trim();
          } else {
            playerName = nameText;
          }
        }

        const pokemonElems = entry.find('[class*="pokemon"], [class*="poke"]');
        pokemonElems.each((_, elem) => {
          const pokemonName = $(elem).text().trim();
          if (pokemonName) {
            pokemonList.push(pokemonName);
          }
        });

        if (playerName) {
          const playerId = this.getOrCreatePlayer(playerName, country);
          const teamId = this.getOrCreateTeam(playerId, tournamentId);

          for (const pokemon of pokemonList) {
            this.savePokemonSet(teamId, pokemon);
          }

          logger.debug({ player: playerName, pokemonCount: pokemonList.length }, 'Saved player team');
        }
      }
    } catch (error) {
      logger.error({ error: String(error), url }, 'Error parsing roster');
    }
  }

  private async scrapePairings(url: string, tournamentId: string): Promise<void> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const roundElems = $('div[class*="round"]');

      for (let i = 0; i < roundElems.length; i++) {
        const roundElem = $(roundElems[i]);
        const roundText = roundElem.text().trim();
        const roundNum = this.extractRoundNumber(roundText);

        const matchups = roundElem.find('div[class*="match"], div[class*="pair"]');

        for (let j = 0; j < matchups.length; j++) {
          const matchup = $(matchups[j]);
          const players = matchup.find('[class*="player"], [class*="name"]');

          if (players.length >= 2) {
            const player1Name = $(players[0]).text().trim();
            const player2Name = $(players[1]).text().trim();

            const matchResult = this.db.prepare(`
              INSERT INTO matches (tournament_id, round_number, table_number)
              VALUES (?, ?, ?)
            `).run(tournamentId, roundNum, null);
            const matchId = matchResult.lastInsertRowid;

            const player1Id = this.getOrCreatePlayer(player1Name);
            const team1Id = this.getOrCreateTeam(player1Id, tournamentId);

            const player2Id = this.getOrCreatePlayer(player2Name);
            const team2Id = this.getOrCreateTeam(player2Id, tournamentId);

            this.db.prepare(`
              INSERT INTO match_participants (match_id, player_id, team_id, score)
              VALUES (?, ?, ?, ?)
            `).run(matchId, player1Id, team1Id, 0);

            this.db.prepare(`
              INSERT INTO match_participants (match_id, player_id, team_id, score)
              VALUES (?, ?, ?, ?)
            `).run(matchId, player2Id, team2Id, 0);
          }
        }
      }

      logger.debug({ tournamentId }, 'Saved pairings');
    } catch (error) {
      logger.error({ error: String(error), url }, 'Error parsing pairings');
    }
  }

  private saveTournament(tournamentId: string, data: Record<string, unknown>): void {
    this.db.prepare(`
      INSERT INTO tournaments (id, name, date, location, generation, format, official)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tournamentId,
      data.name,
      data.date,
      data.location,
      data.generation,
      data.format,
      1
    );
  }

  private savePokemonSet(teamId: number, pokemonName: string): void {
    this.db.prepare(`
      INSERT INTO pokemon_sets (team_id, species)
      VALUES (?, ?)
    `).run(teamId, pokemonName);
  }

  private extractRoundNumber(roundText: string): number {
    const match = roundText.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
    return 1;
  }
}
