import { BaseScraper } from './base.js';
import { APIClient } from '@vgc/common/api.js';
import { logger } from '@vgc/common/logging.js';
import { DB } from '../database/db.js';

export interface LimitlessTournament {
  id: string;
  name: string;
  date: string;
  format?: string;
}

export interface LimitlessScraperOptions {
  apiKey: string;
  rateLimit?: number;
}

export class LimitlessScraper extends BaseScraper {
  private apiKey: string;
  private baseUrl: string = 'https://play.limitlesstcg.com/api';
  private rateLimit: number;

  constructor(db: DB, options: LimitlessScraperOptions) {
    super(db);
    this.apiKey = options.apiKey;
    this.rateLimit = options.rateLimit || 200;
  }

  async scrape(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const formatFilter = params.format_filter as string | undefined;
    const limit = params.limit as number | undefined;
    const since = params.since as string | undefined;
    const page = (params.page as number) || 1;

    if (!this.apiKey) {
      logger.error('Limitless API key not provided');
      return { success: false, error: 'API key required' };
    }

    const client = new APIClient({
      baseUrl: this.baseUrl,
      headers: { 'X-Access-Key': this.apiKey },
      rateLimit: this.rateLimit,
    });

    const allTournaments: LimitlessTournament[] = [];
    let currentPage = page;

    while (true) {
      const queryParams: Record<string, unknown> = { page: currentPage };
      if (formatFilter) {
        if (['svf', 'reg f'].includes(formatFilter.toLowerCase())) {
          queryParams.format = formatFilter.toUpperCase();
        } else {
          queryParams.format = formatFilter;
        }
      }

      logger.info({ page: currentPage, format: formatFilter, params: queryParams }, 'Fetching tournaments');

      const tournamentsData = await client.get<LimitlessTournament[]>('/tournaments', queryParams);
      if (!tournamentsData || tournamentsData.length === 0) {
        logger.info({ page: currentPage }, 'No tournaments on this page, stopping pagination');
        break;
      }

      allTournaments.push(...tournamentsData);
      logger.info({ page: currentPage, count: tournamentsData.length }, 'Fetched tournaments');

      if (tournamentsData.length < 50) {
        logger.info({ page: currentPage }, 'End of pagination (fewer than 50 tournaments)');
        break;
      }

      currentPage++;
    }

    logger.info({ total: allTournaments.length }, 'Total tournaments fetched');

    if (since) {
      this.filterByDate(allTournaments, since);
      logger.info({ since, count: allTournaments.length }, 'Filtered tournaments by date');
    }

    if (limit) {
      allTournaments.splice(limit);
    }

    logger.info({ count: allTournaments.length }, 'Found tournaments');

    const results: Record<string, unknown> = {
      success: true,
      tournamentsScraped: 0,
      rawResponsesStored: 0,
    };

    for (const tournamentData of allTournaments) {
      await this.scrapeTournament(client, tournamentData, results);
    }

    return results;
  }

  private filterByDate(tournaments: LimitlessTournament[], sinceDate: string): void {
    const sinceDt = new Date(sinceDate);
    if (isNaN(sinceDt.getTime())) {
      logger.error({ since: sinceDate }, 'Invalid since date format. Use YYYY-MM-DD');
      return;
    }

    const filtered: LimitlessTournament[] = [];
    for (const tournament of tournaments) {
      const tournamentDate = new Date(tournament.date);
      if (!isNaN(tournamentDate.getTime()) && tournamentDate > sinceDt) {
        filtered.push(tournament);
      }
    }
    tournaments.length = 0;
    tournaments.push(...filtered);
  }

  private rawDataExists(tournamentId: string): boolean {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM limitless_api_raw_data WHERE id = ?').get(tournamentId) as { count: number };
    return result.count > 0;
  }

  private storeRawResponse(tournamentId: string, details: unknown, standings: unknown, pairings: unknown): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO limitless_api_raw_data (id, details, standings, pairings)
      VALUES (?, ?, ?, ?)
    `).run(tournamentId, JSON.stringify(details), JSON.stringify(standings), JSON.stringify(pairings));
  }

  private async scrapeTournament(client: APIClient, tournamentData: LimitlessTournament, results: Record<string, unknown>): Promise<void> {
    const tournamentId = tournamentData.id;

    logger.info({ id: tournamentId, name: tournamentData.name }, 'Scraping tournament');

    if (this.rawDataExists(tournamentId)) {
      logger.info({ id: tournamentId }, 'Raw data already exists, skipping');
      return;
    }

    const detailsResponse = await client.get(`/tournaments/${tournamentId}/details`);
    const standingsResponse = await client.get(`/tournaments/${tournamentId}/standings`);
    const pairingsResponse = await client.get(`/tournaments/${tournamentId}/pairings`);

    if (detailsResponse || standingsResponse || pairingsResponse) {
      this.storeRawResponse(
        tournamentId,
        detailsResponse || {},
        standingsResponse || {},
        pairingsResponse || {}
      );
      results.rawResponsesStored = (results.rawResponsesStored as number) + 1;
    }

    logger.info({ tournamentId }, 'Raw data stored');
  }
}
