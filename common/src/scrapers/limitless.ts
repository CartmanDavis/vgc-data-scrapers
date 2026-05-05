import { APIClient } from '@vgc/common/api';
import { logger } from '@vgc/common/logging';

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

export interface ScrapedRawData {
  id: string;
  details: unknown;
  standings: unknown;
  pairings: unknown;
}

export class LimitlessScraper {
  private apiKey: string;
  private baseUrl: string = 'https://play.limitlesstcg.com/api';
  private rateLimit: number;

  constructor(options: LimitlessScraperOptions) {
    this.apiKey = options.apiKey;
    this.rateLimit = options.rateLimit || 200;
  }

  async scrapeSingle(tournamentId: string): Promise<{ success: boolean; rawDataFetched: ScrapedRawData[] }> {
    if (!this.apiKey) {
      logger.error('Limitless API key not provided');
      return { success: false, rawDataFetched: [] };
    }

    const client = new APIClient({
      baseUrl: this.baseUrl,
      headers: { 'X-Access-Key': this.apiKey },
      rateLimit: this.rateLimit,
    });

    const detailsResponse = await client.get(`/tournaments/${tournamentId}/details`);
    const standingsResponse = await client.get(`/tournaments/${tournamentId}/standings`);
    const pairingsResponse = await client.get(`/tournaments/${tournamentId}/pairings`);

    if (!detailsResponse && !standingsResponse && !pairingsResponse) {
      return { success: false, rawDataFetched: [] };
    }

    const raw: ScrapedRawData = {
      id: tournamentId,
      details: detailsResponse || {},
      standings: standingsResponse || {},
      pairings: pairingsResponse || {},
    };

    logger.info({ tournamentId }, 'Fetched raw tournament data');
    return { success: true, rawDataFetched: [raw] };
  }

  async scrape(params: {
    format_filter?: string;
    since?: string;
    skipIds?: Set<string>;
  }): Promise<{ success: boolean; tournamentsFound: number; rawDataFetched: ScrapedRawData[] }> {
    const { format_filter: formatFilter, since, skipIds } = params;

    if (!this.apiKey) {
      logger.error('Limitless API key not provided');
      return { success: false, tournamentsFound: 0, rawDataFetched: [] };
    }

    if (since) {
      logger.info({ since }, 'Scraping tournaments since date');
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

      logger.info({ page: currentPage, format: formatFilter }, 'Fetching tournaments page');

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

      // API returns newest-first; stop once the oldest result on this page predates since
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

    // Filter by date
    let filtered = allTournaments;
    if (sinceDt) {
      filtered = allTournaments.filter(t => {
        const d = new Date(t.date);
        return !isNaN(d.getTime()) && d > sinceDt;
      });
      logger.info({ since, count: filtered.length }, 'Filtered tournaments by date');
    }

    // Filter out already-stored tournaments
    if (skipIds?.size) {
      filtered = filtered.filter(t => !skipIds.has(t.id));
      logger.info({ skipped: allTournaments.length - filtered.length, remaining: filtered.length }, 'Skipped already-stored tournaments');
    }

    logger.info({ count: filtered.length }, 'Tournaments to scrape');

    const rawDataFetched: ScrapedRawData[] = [];

    for (const tournamentData of filtered) {
      const raw = await this.fetchTournament(client, tournamentData);
      if (raw) rawDataFetched.push(raw);
    }

    return { success: true, tournamentsFound: filtered.length, rawDataFetched };
  }

  private async fetchTournament(client: APIClient, tournamentData: LimitlessTournament): Promise<ScrapedRawData | null> {
    const tournamentId = tournamentData.id;
    logger.info({ id: tournamentId, name: tournamentData.name }, 'Fetching tournament');

    const detailsResponse = await client.get(`/tournaments/${tournamentId}/details`);
    const standingsResponse = await client.get(`/tournaments/${tournamentId}/standings`);
    const pairingsResponse = await client.get(`/tournaments/${tournamentId}/pairings`);

    if (!detailsResponse && !standingsResponse && !pairingsResponse) {
      logger.warn({ tournamentId }, 'No data returned for tournament');
      return null;
    }

    logger.info({ tournamentId }, 'Fetched tournament data');
    return {
      id: tournamentId,
      details: detailsResponse || {},
      standings: standingsResponse || {},
      pairings: pairingsResponse || {},
    };
  }
}
