import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LimitlessScraper } from '../scrapers/limitless.js';
import type { IDataStore } from '../database/interfaces.js';

// vi.hoisted ensures mockGet is initialized before the vi.mock factory runs
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@vgc/common/api', () => ({
  APIClient: vi.fn(function (this: unknown) {
    return { get: mockGet };
  }),
}));

vi.mock('@vgc/common/logging', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function makeMockDb(): IDataStore {
  return {
    ensureTournamentStub: vi.fn().mockResolvedValue(undefined),
    rawDataExists: vi.fn().mockResolvedValue(false),
    storeRawData: vi.fn().mockResolvedValue(undefined),
    getRawData: vi.fn().mockResolvedValue([]),
    isTournamentProcessed: vi.fn().mockResolvedValue(false),
    tournamentExists: vi.fn().mockResolvedValue(false),
    upsertTournament: vi.fn().mockResolvedValue(undefined),
    findOrCreatePlayer: vi.fn().mockResolvedValue(1),
    findOrCreateTeam: vi.fn().mockResolvedValue(1),
    insertPokemonSet: vi.fn().mockResolvedValue(1),
    insertMove: vi.fn().mockResolvedValue(undefined),
    insertMatch: vi.fn().mockResolvedValue(1),
    upsertMatchParticipant: vi.fn().mockResolvedValue(undefined),
    upsertStanding: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  };
}

const DETAILS = { name: 'Test Cup', date: '2026-01-15', format: 'M-A', game: 'VGC' };

describe('LimitlessScraper', () => {
  let db: IDataStore;
  let scraper: LimitlessScraper;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeMockDb();
    scraper = new LimitlessScraper(db, { apiKey: 'test-key' });
  });

  describe('scrapeSingle', () => {
    it('returns failure when API key is empty', async () => {
      const noKeyScraper = new LimitlessScraper(makeMockDb(), { apiKey: '' });
      const result = await noKeyScraper.scrapeSingle('T1');
      expect(result.success).toBe(false);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('fetches details, standings, and pairings endpoints', async () => {
      mockGet
        .mockResolvedValueOnce(DETAILS)
        .mockResolvedValueOnce([{ name: 'Alice' }])
        .mockResolvedValueOnce([{ round: 1 }]);

      await scraper.scrapeSingle('T1');

      expect(mockGet).toHaveBeenCalledWith('/tournaments/T1/details');
      expect(mockGet).toHaveBeenCalledWith('/tournaments/T1/standings');
      expect(mockGet).toHaveBeenCalledWith('/tournaments/T1/pairings');
    });

    it('stores raw data and creates tournament stub on success', async () => {
      mockGet
        .mockResolvedValueOnce(DETAILS)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await scraper.scrapeSingle('T1');

      expect(db.ensureTournamentStub).toHaveBeenCalledWith(
        'T1', 'Test Cup', '2026-01-15', expect.any(String), expect.any(Number),
      );
      expect(db.storeRawData).toHaveBeenCalledTimes(1);
    });

    it('stores empty objects for null standings and pairings', async () => {
      mockGet
        .mockResolvedValueOnce(DETAILS)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await scraper.scrapeSingle('T1');

      expect(db.storeRawData).toHaveBeenCalledWith('T1', DETAILS, {}, {});
    });

    it('does not store data when all three endpoints return null', async () => {
      mockGet.mockResolvedValue(null);

      await scraper.scrapeSingle('T1');

      expect(db.storeRawData).not.toHaveBeenCalled();
      expect(db.ensureTournamentStub).not.toHaveBeenCalled();
    });

    it('returns success: false when all endpoints return null', async () => {
      mockGet.mockResolvedValue(null);

      const result = await scraper.scrapeSingle('T1');
      expect(result.success).toBe(false);
    });

    it('parses format from tournament details and passes to stub', async () => {
      mockGet
        .mockResolvedValueOnce({ ...DETAILS, format: 'gen9vgc2026regf' })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await scraper.scrapeSingle('T1');

      expect(db.ensureTournamentStub).toHaveBeenCalledWith(
        'T1', expect.any(String), expect.any(String), 'regf', 9,
      );
    });

    it('falls back to tournament ID as name when details name is missing', async () => {
      mockGet
        .mockResolvedValueOnce({ date: '2026-01-01', format: 'M-A' })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await scraper.scrapeSingle('my-tournament-id');

      expect(db.ensureTournamentStub).toHaveBeenCalledWith(
        'my-tournament-id', 'my-tournament-id', expect.any(String), expect.any(String), expect.any(Number),
      );
    });
  });

  describe('scrape', () => {
    it('returns failure when API key is empty', async () => {
      const noKeyScraper = new LimitlessScraper(makeMockDb(), { apiKey: '' });
      const result = await noKeyScraper.scrape({});
      expect(result.success).toBe(false);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('stops pagination immediately when first page is empty', async () => {
      mockGet.mockResolvedValueOnce([]);

      await scraper.scrape({});

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('stops pagination when page returns null', async () => {
      mockGet.mockResolvedValueOnce(null);

      await scraper.scrape({});

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('continues to page 2 when page 1 has 50 results', async () => {
      const page1 = Array.from({ length: 50 }, (_, i) => ({
        id: `t${i}`, name: `T${i}`, date: '2026-05-01', format: 'M-A',
      }));
      (db.rawDataExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      mockGet
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce([]); // page 2 empty → stop

      await scraper.scrape({});

      expect(mockGet).toHaveBeenNthCalledWith(1, '/tournaments', expect.objectContaining({ page: 1 }));
      expect(mockGet).toHaveBeenNthCalledWith(2, '/tournaments', expect.objectContaining({ page: 2 }));
    });

    it('stops after page with fewer than 50 results', async () => {
      const smallPage = Array.from({ length: 3 }, (_, i) => ({
        id: `t${i}`, name: `T${i}`, date: '2026-05-01', format: 'M-A',
      }));
      (db.rawDataExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      mockGet.mockResolvedValueOnce(smallPage);

      await scraper.scrape({});

      // Only 1 list call, then 0 per-tournament calls (all already exist)
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('sends format filter to API', async () => {
      mockGet.mockResolvedValue([]);

      await scraper.scrape({ format_filter: 'M-A' });

      expect(mockGet).toHaveBeenCalledWith('/tournaments', expect.objectContaining({ format: 'M-A' }));
    });

    it('sends game=VGC filter to API', async () => {
      mockGet.mockResolvedValue([]);

      await scraper.scrape({});

      expect(mockGet).toHaveBeenCalledWith('/tournaments', expect.objectContaining({ game: 'VGC' }));
    });

    it('filters out tournaments on exactly the since date (strict greater-than)', async () => {
      const tournaments = [
        { id: 'before', name: 'Before', date: '2026-01-01', format: 'M-A' },
        { id: 'exact', name: 'Exact', date: '2026-01-15', format: 'M-A' },
        { id: 'after', name: 'After', date: '2026-01-20', format: 'M-A' },
      ];
      (db.rawDataExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      mockGet.mockResolvedValueOnce(tournaments);

      await scraper.scrape({ since: '2026-01-15' });

      // Only 'after' (strictly after 2026-01-15) passes the filter
      expect(db.rawDataExists).toHaveBeenCalledTimes(1);
      expect(db.rawDataExists).toHaveBeenCalledWith('after');
    });

    it('filters out all tournaments before or on the since date', async () => {
      const tournaments = [
        { id: 'old1', name: 'Old1', date: '2025-12-01', format: 'M-A' },
        { id: 'old2', name: 'Old2', date: '2026-01-15', format: 'M-A' },
      ];
      mockGet.mockResolvedValueOnce(tournaments);

      await scraper.scrape({ since: '2026-01-15' });

      expect(db.rawDataExists).not.toHaveBeenCalled();
    });

    it('skips tournaments that already have raw data', async () => {
      mockGet.mockResolvedValueOnce([{ id: 'T1', name: 'Test', date: '2026-05-01', format: 'M-A' }]);
      (db.rawDataExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await scraper.scrape({});

      expect(db.storeRawData).not.toHaveBeenCalled();
    });

    it('scrapes and stores new tournament', async () => {
      mockGet
        .mockResolvedValueOnce([{ id: 'T1', name: 'Test', date: '2026-05-01', format: 'M-A' }])
        .mockResolvedValueOnce(DETAILS)
        .mockResolvedValueOnce([{ name: 'Alice' }])
        .mockResolvedValueOnce([{ round: 1 }]);
      (db.rawDataExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await scraper.scrape({});

      expect(db.storeRawData).toHaveBeenCalledTimes(1);
      expect(result.rawResponsesStored).toBe(1);
    });

    it('skips already-existing tournaments without fetching their data', async () => {
      mockGet.mockResolvedValueOnce([{ id: 'T1', name: 'Test', date: '2026-05-01', format: 'M-A' }]);
      (db.rawDataExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await scraper.scrape({});

      // Only 1 call for the list page; no per-tournament endpoint calls
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns success: true on completion', async () => {
      mockGet.mockResolvedValue([]);

      const result = await scraper.scrape({});

      expect(result.success).toBe(true);
    });

    it('handles invalid since date gracefully', async () => {
      mockGet.mockResolvedValueOnce([{ id: 'T1', name: 'Test', date: '2026-05-01', format: 'M-A' }]);
      (db.rawDataExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      // Invalid date string should not throw; behavior is to skip filtering
      await expect(scraper.scrape({ since: 'not-a-date' })).resolves.not.toThrow();
    });
  });

  describe('parseFormat (via BaseScraper)', () => {
    it('parses gen9vgc2026regf into generation 9 and format regf', async () => {
      mockGet
        .mockResolvedValueOnce({ name: 'T', date: '2026-01-01', format: 'gen9vgc2026regf' })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await scraper.scrapeSingle('T1');

      expect(db.ensureTournamentStub).toHaveBeenCalledWith('T1', 'T', '2026-01-01', 'regf', 9);
    });

    it('maps svf shorthand to reg f format', async () => {
      mockGet
        .mockResolvedValueOnce({ name: 'T', date: '2026-01-01', format: 'svf' })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await scraper.scrapeSingle('T1');

      expect(db.ensureTournamentStub).toHaveBeenCalledWith('T1', 'T', '2026-01-01', 'reg f', 9);
    });

    it('falls back to generation 9 for unrecognized formats', async () => {
      mockGet
        .mockResolvedValueOnce({ name: 'T', date: '2026-01-01', format: 'M-A' })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await scraper.scrapeSingle('T1');

      expect(db.ensureTournamentStub).toHaveBeenCalledWith('T1', 'T', '2026-01-01', 'm-a', 9);
    });
  });
});
