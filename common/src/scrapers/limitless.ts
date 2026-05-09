import { BaseScraper } from './base.js';
import { APIClient } from '@vgc/common/api';
import { logger } from '@vgc/common/logging';
import type { IDataStore } from '../database/interfaces.js';

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

  constructor(db: IDataStore, options: LimitlessScraperOptions) {
    super(db);
    this.apiKey = options.apiKey;
    this.rateLimit = options.rateLimit || 200;
  }

  async scrapeSingle(tournamentId: string): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      logger.error('Limitless API key not provided');
      return { success: false, error: 'API key required' };
    }

    const client = new APIClient({
      baseUrl: this.baseUrl,
      headers: { 'X-Access-Key': this.apiKey },
      rateLimit: this.rateLimit,
    });

    const detailsResponse = await client.get(`/tournaments/${tournamentId}/details`) as Record<string, unknown> | null;
    const standingsResponse = await client.get(`/tournaments/${tournamentId}/standings`);
    const pairingsResponse = await client.get(`/tournaments/${tournamentId}/pairings`);

    if (!detailsResponse && !standingsResponse && !pairingsResponse) {
      logger.warn({ tournamentId }, 'No data returned for tournament');
      return { success: false, error: 'No data returned from API' };
    }

    const details = detailsResponse || {};
    const { generation, format } = this.parseFormat((details as Record<string, unknown>).format as string || '');
    await this.db.ensureTournamentStub(
      tournamentId,
      (details as Record<string, unknown>).name as string || tournamentId,
      (details as Record<string, unknown>).date as string || new Date().toISOString(),
      format,
      generation,
    );
    await this.db.storeRawData(tournamentId, details, standingsResponse || {}, pairingsResponse || {});

    logger.info({ tournamentId }, 'Raw data stored');
    return { success: true, tournamentsScraped: 0, rawResponsesStored: 1 };
  }

  async scrape(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const formatFilter = params.format_filter as string | undefined;
    const since = params.since as string | undefined;

    if (!this.apiKey) {
      logger.error('Limitless API key not provided');
      return { success: false, error: 'API key required' };
    }

    const client = new APIClient({
      baseUrl: this.baseUrl,
      headers: { 'X-Access-Key': this.apiKey },
      rateLimit: this.rateLimit,
    });

    const sinceDt = since ? new Date(since) : null;
    const allTournaments: LimitlessTournament[] = [];
    let currentPage = 1;

    while (true) {
      const queryParams: Record<string, unknown> = { page: currentPage, game: 'VGC' };
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

      // Stop early once the oldest result on this page predates --since, avoiding
      // fetching additional pages that won't have any new tournaments.
      if (sinceDt) {
        const oldest = tournamentsData.reduce((min, t) => {
          const d = new Date(t.date);
          return !isNaN(d.getTime()) && d < min ? d : min;
        }, new Date());
        if (oldest <= sinceDt) {
          logger.info({ page: currentPage, since }, 'Oldest result on page predates since, stopping pagination');
          break;
        }
      }

      currentPage++;
    }

    logger.info({ total: allTournaments.length }, 'Total tournaments fetched');

    if (since) {
      this.filterByDate(allTournaments, since);
      logger.info({ since, count: allTournaments.length }, 'Filtered tournaments by date');
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

  private async scrapeTournament(
    client: APIClient,
    tournamentData: LimitlessTournament,
    results: Record<string, unknown>,
  ): Promise<void> {
    const tournamentId = tournamentData.id;
    logger.info({ id: tournamentId, name: tournamentData.name }, 'Scraping tournament');

    if (await this.db.rawDataExists(tournamentId)) {
      logger.info({ id: tournamentId }, 'Raw data already exists, skipping');
      return;
    }

    const detailsResponse = await client.get(`/tournaments/${tournamentId}/details`);
    const standingsResponse = await client.get(`/tournaments/${tournamentId}/standings`);
    const pairingsResponse = await client.get(`/tournaments/${tournamentId}/pairings`);

    if (detailsResponse || standingsResponse || pairingsResponse) {
      const { generation, format } = this.parseFormat(tournamentData.format || '');
      await this.db.ensureTournamentStub(
        tournamentId,
        tournamentData.name,
        tournamentData.date,
        format,
        generation,
      );
      await this.db.storeRawData(
        tournamentId,
        detailsResponse || {},
        standingsResponse || {},
        pairingsResponse || {},
      );
      results.rawResponsesStored = (results.rawResponsesStored as number) + 1;
    }

    logger.info({ tournamentId }, 'Raw data stored');
  }
}
