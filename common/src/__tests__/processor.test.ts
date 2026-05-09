import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataProcessor } from '../processors/processor.js';
import type { IDataStore } from '../database/interfaces.js';

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

function makeRawRow(overrides: {
  id?: string;
  details?: object | null;
  standings?: unknown[];
  pairings?: unknown[];
} = {}) {
  const { id = 'T1', details = {}, standings = [], pairings = [] } = overrides;
  return {
    id,
    details: details === null ? null : JSON.stringify(details),
    standings: JSON.stringify(standings),
    pairings: JSON.stringify(pairings),
  };
}

const VGC_DETAILS = { name: 'Test Cup', date: '2026-01-15', format: 'M-A', game: 'VGC' };

const ALICE_STANDING = {
  name: 'Alice',
  country: 'US',
  placing: 1,
  record: { wins: 8, losses: 1, ties: 0 },
  drop: false,
  decklist: [
    { name: 'Pikachu', item: 'Choice Band', ability: 'Static', tera: 'Electric', attacks: ['Thunderbolt'] },
  ],
};

const BOB_STANDING = {
  name: 'Bob',
  country: 'UK',
  placing: 2,
  record: { wins: 7, losses: 2, ties: 0 },
  drop: false,
  decklist: [],
};

describe('DataProcessor', () => {
  let db: IDataStore;
  let processor: DataProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeMockDb();
    processor = new DataProcessor(db);
  });

  describe('processTournaments', () => {
    it('returns error for unsupported source', async () => {
      const result = await processor.processTournaments({ source: 'rk9' });
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unsupported source: rk9');
    });

    it('returns success with zero counts when no raw data', async () => {
      const result = await processor.processTournaments();
      expect(result.success).toBe(true);
      expect(result.tournamentsProcessed).toBe(0);
      expect((result.errors as string[]).length).toBe(0);
    });

    it('skips non-VGC tournaments', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: { name: 'TCG Cup', date: '2026-01-01', format: 'SWSH', game: 'TCG' } }),
      ]);

      const result = await processor.processTournaments();

      expect(db.upsertTournament).not.toHaveBeenCalled();
      expect(result.tournamentsProcessed).toBe(0);
    });

    it('processes VGC tournaments that have no game field', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: { name: 'Test', date: '2026-01-01', format: 'M-A' } }),
      ]);

      await processor.processTournaments();
      expect(db.upsertTournament).toHaveBeenCalled();
    });

    it('skips already processed tournaments', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([makeRawRow({ details: VGC_DETAILS })]);
      (db.isTournamentProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await processor.processTournaments();

      expect(db.upsertTournament).not.toHaveBeenCalled();
    });

    it('force re-processes already processed tournaments', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([makeRawRow({ details: VGC_DETAILS })]);
      (db.isTournamentProcessed as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await processor.processTournaments({ force: true });

      expect(db.upsertTournament).toHaveBeenCalled();
    });

    it('skips tournaments with null details field', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([makeRawRow({ details: null })]);

      await processor.processTournaments();

      expect(db.upsertTournament).not.toHaveBeenCalled();
    });

    it('filters by specific tournament IDs', async () => {
      await processor.processTournaments({ tournamentIds: ['T1', 'T2'] });

      expect(db.getRawData).toHaveBeenCalledWith(['T1', 'T2']);
    });

    it('passes undefined to getRawData when no IDs specified', async () => {
      await processor.processTournaments();

      expect(db.getRawData).toHaveBeenCalledWith(undefined);
    });
  });

  describe('tournament processing', () => {
    it('upserts tournament with name and date from details', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([makeRawRow({ details: VGC_DETAILS })]);

      await processor.processTournaments();

      expect(db.upsertTournament).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'T1', name: 'Test Cup', date: '2026-01-15' }),
      );
    });

    it('creates player with name and country from standing', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [ALICE_STANDING] }),
      ]);

      await processor.processTournaments();

      expect(db.findOrCreatePlayer).toHaveBeenCalledWith('Alice', 'US');
    });

    it('upserts standing with correct win/loss/tie record', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [ALICE_STANDING] }),
      ]);

      await processor.processTournaments();

      expect(db.upsertStanding).toHaveBeenCalledWith(
        expect.objectContaining({ wins: 8, losses: 1, ties: 0, placing: 1, dropped: false }),
      );
    });

    it('upserts standing with dropped=true for dropped players', async () => {
      const droppedStanding = { ...ALICE_STANDING, drop: true, placing: null };
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [droppedStanding] }),
      ]);

      await processor.processTournaments();

      expect(db.upsertStanding).toHaveBeenCalledWith(
        expect.objectContaining({ dropped: true }),
      );
    });

    it('inserts pokemon sets from decklist', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [ALICE_STANDING] }),
      ]);

      await processor.processTournaments();

      expect(db.insertPokemonSet).toHaveBeenCalledTimes(1);
      expect(db.insertPokemonSet).toHaveBeenCalledWith(
        expect.objectContaining({ species: 'Pikachu' }),
      );
    });

    it('inserts moves for each pokemon set', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [ALICE_STANDING] }),
      ]);

      await processor.processTournaments();

      expect(db.insertMove).toHaveBeenCalledWith(1, 'Thunderbolt');
    });

    it('skips pokemon with empty name', async () => {
      const standingWithBadMon = {
        ...BOB_STANDING,
        decklist: [{ name: '', attacks: [] }],
      };
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [standingWithBadMon] }),
      ]);

      await processor.processTournaments();

      // Invalid pokemon still gets inserted (marked invalid=true), not skipped
      expect(db.insertPokemonSet).toHaveBeenCalledWith(
        expect.objectContaining({ invalid: true }),
      );
    });

    it('increments tournamentsProcessed correctly', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ id: 'T1', details: VGC_DETAILS }),
        makeRawRow({ id: 'T2', details: VGC_DETAILS }),
      ]);

      const result = await processor.processTournaments();

      expect(result.tournamentsProcessed).toBe(2);
    });

    it('increments playersAdded for each unique player', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [ALICE_STANDING, BOB_STANDING] }),
      ]);

      const result = await processor.processTournaments();

      expect(result.playersAdded).toBe(2);
    });

    it('tracks tournamentStandingsAdded for every standing row', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [ALICE_STANDING, BOB_STANDING] }),
      ]);

      const result = await processor.processTournaments();

      expect(result.tournamentStandingsAdded).toBe(2);
    });

    it('does not double-count player when they appear twice in standings', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({ details: VGC_DETAILS, standings: [ALICE_STANDING, ALICE_STANDING] }),
      ]);

      const result = await processor.processTournaments();

      // Alice appears twice but should only be counted once as a player
      expect(result.playersAdded).toBe(1);
    });
  });

  describe('pairing processing', () => {
    it('inserts a match row for each pairing', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({
          details: VGC_DETAILS,
          standings: [ALICE_STANDING, BOB_STANDING],
          pairings: [{ round: 1, phase: 1, table: 5, player1: 'Alice', player2: 'Bob', winner: 'Alice' }],
        }),
      ]);

      await processor.processTournaments();

      expect(db.insertMatch).toHaveBeenCalledWith(
        expect.objectContaining({ tournamentId: 'T1', roundNumber: 1, tableNumber: 5 }),
      );
    });

    it('assigns score 1 to winner and 0 to loser', async () => {
      let playerIdCounter = 0;
      let teamIdCounter = 0;
      (db.findOrCreatePlayer as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve(++playerIdCounter),
      );
      (db.findOrCreateTeam as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve(++teamIdCounter),
      );

      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({
          details: VGC_DETAILS,
          standings: [ALICE_STANDING, BOB_STANDING],
          pairings: [{ round: 1, phase: 1, table: 1, player1: 'Alice', player2: 'Bob', winner: 'Bob' }],
        }),
      ]);

      await processor.processTournaments();

      const participantCalls = (db.upsertMatchParticipant as ReturnType<typeof vi.fn>).mock.calls;
      const scores = participantCalls.map((c) => c[0].score);
      expect(scores).toContain(0); // Alice loses
      expect(scores).toContain(1); // Bob wins
    });

    it('silently skips unknown players in pairings', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({
          details: VGC_DETAILS,
          standings: [ALICE_STANDING],
          pairings: [{ round: 1, phase: 1, table: 1, player1: 'Alice', player2: 'Ghost Player', winner: 'Alice' }],
        }),
      ]);

      await expect(processor.processTournaments()).resolves.not.toThrow();

      // Only Alice (known) gets a match participant row; Ghost Player is silently skipped
      expect(db.upsertMatchParticipant).toHaveBeenCalledTimes(1);
    });

    it('increments matchesAdded for each pairing', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeRawRow({
          details: VGC_DETAILS,
          standings: [ALICE_STANDING, BOB_STANDING],
          pairings: [
            { round: 1, phase: 1, table: 1, player1: 'Alice', player2: 'Bob', winner: 'Alice' },
            { round: 2, phase: 1, table: 3, player1: 'Alice', player2: 'Bob', winner: 'Bob' },
          ],
        }),
      ]);

      const result = await processor.processTournaments();
      expect(result.matchesAdded).toBe(2);
    });
  });

  describe('error handling', () => {
    it('catches JSON parse errors and records them', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'T1', details: '{ invalid json', standings: '[]', pairings: '[]' },
      ]);

      const result = await processor.processTournaments();

      expect((result.errors as string[]).length).toBe(1);
      expect((result.errors as string[])[0]).toContain('T1');
    });

    it('continues processing remaining tournaments after one fails', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'T1', details: '{ bad json', standings: '[]', pairings: '[]' },
        makeRawRow({ id: 'T2', details: VGC_DETAILS }),
      ]);

      const result = await processor.processTournaments();

      expect((result.errors as string[]).length).toBe(1);
      expect(result.tournamentsProcessed).toBe(1);
    });

    it('catches db errors thrown during processing', async () => {
      (db.getRawData as ReturnType<typeof vi.fn>).mockResolvedValue([makeRawRow({ details: VGC_DETAILS })]);
      (db.upsertTournament as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB connection lost'));

      const result = await processor.processTournaments();

      expect((result.errors as string[]).length).toBe(1);
      expect((result.errors as string[])[0]).toContain('DB connection lost');
    });
  });
});
