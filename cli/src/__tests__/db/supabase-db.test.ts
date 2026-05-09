import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseDataStore } from '../../db/supabase-db.js';

const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

/**
 * Creates a chainable Supabase query builder mock that:
 * - Returns itself from all chain methods (select, eq, in, upsert, insert)
 * - Resolves to `resolvedValue` when awaited directly (then/catch)
 * - Resolves to `resolvedValue` from terminal methods (maybeSingle, single)
 */
function makeBuilder(resolvedValue: unknown = { data: null, error: null }) {
  const b: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'upsert', 'insert']) {
    b[method] = vi.fn().mockReturnValue(b);
  }
  b.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  b.single = vi.fn().mockResolvedValue(resolvedValue);
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(res, rej);
  b.catch = (rej: (e: unknown) => unknown) => Promise.resolve(resolvedValue).catch(rej);
  return b;
}

describe('SupabaseDataStore', () => {
  let store: SupabaseDataStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new SupabaseDataStore('https://example.supabase.co', 'service-key');
  });

  describe('ensureTournamentStub', () => {
    it('upserts tournament with all required fields', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.ensureTournamentStub('t1', 'Test Tournament', '2026-01-01', 'reg f', 9);

      expect(mockFrom).toHaveBeenCalledWith('tournaments');
      expect(b.upsert).toHaveBeenCalledWith(
        { id: 't1', name: 'Test Tournament', date: '2026-01-01', format: 'reg f', generation: 9, official: false },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    });

    it('always sets official to false', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.ensureTournamentStub('t1', 'Test', '2026-01-01', 'M-A', 9);

      expect(b.upsert).toHaveBeenCalledWith(expect.objectContaining({ official: false }), expect.anything());
    });

    it('throws when upsert returns an error', async () => {
      const b = makeBuilder({ error: { message: 'DB write failed' } });
      mockFrom.mockReturnValue(b);

      await expect(store.ensureTournamentStub('t1', 'Test', '2026-01-01', 'M-A', 9))
        .rejects.toThrow('ensureTournamentStub: DB write failed');
    });
  });

  describe('rawDataExists', () => {
    it('returns true when a matching row exists', async () => {
      const b = makeBuilder({ data: { id: 't1' } });
      mockFrom.mockReturnValue(b);

      expect(await store.rawDataExists('t1')).toBe(true);
    });

    it('returns false when no matching row exists', async () => {
      const b = makeBuilder({ data: null });
      mockFrom.mockReturnValue(b);

      expect(await store.rawDataExists('missing')).toBe(false);
    });

    it('queries the correct table and column', async () => {
      const b = makeBuilder({ data: null });
      mockFrom.mockReturnValue(b);

      await store.rawDataExists('t1');

      expect(mockFrom).toHaveBeenCalledWith('limitless_api_raw_data');
      expect(b.select).toHaveBeenCalledWith('id');
      expect(b.eq).toHaveBeenCalledWith('id', 't1');
    });
  });

  describe('storeRawData', () => {
    it('upserts raw JSON blobs for the tournament', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.storeRawData('t1', { game: 'VGC' }, [{ name: 'Alice' }], [{ round: 1 }]);

      expect(b.upsert).toHaveBeenCalledWith(
        { id: 't1', details: { game: 'VGC' }, standings: [{ name: 'Alice' }], pairings: [{ round: 1 }] },
        { onConflict: 'id' },
      );
    });

    it('throws when upsert returns an error', async () => {
      const b = makeBuilder({ error: { message: 'Constraint violation' } });
      mockFrom.mockReturnValue(b);

      await expect(store.storeRawData('t1', {}, {}, {}))
        .rejects.toThrow('storeRawData: Constraint violation');
    });
  });

  describe('getRawData', () => {
    it('fetches all rows when no IDs provided', async () => {
      const b = makeBuilder({ data: [{ id: 't1', details: { x: 1 }, standings: [], pairings: [] }], error: null });
      mockFrom.mockReturnValue(b);

      const rows = await store.getRawData();

      expect(b.in).not.toHaveBeenCalled();
      expect(rows).toHaveLength(1);
    });

    it('applies an IN filter when tournament IDs are provided', async () => {
      const b = makeBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(b);

      await store.getRawData(['t1', 't2']);

      expect(b.in).toHaveBeenCalledWith('id', ['t1', 't2']);
    });

    it('serializes JSON fields to strings', async () => {
      const b = makeBuilder({
        data: [{ id: 't1', details: { x: 1 }, standings: { y: 2 }, pairings: { z: 3 } }],
        error: null,
      });
      mockFrom.mockReturnValue(b);

      const [row] = await store.getRawData();
      expect(row.details).toBe('{"x":1}');
      expect(row.standings).toBe('{"y":2}');
      expect(row.pairings).toBe('{"z":3}');
    });

    it('returns empty array when no data', async () => {
      const b = makeBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(b);

      expect(await store.getRawData()).toEqual([]);
    });

    it('throws on query error', async () => {
      const b = makeBuilder({ data: null, error: { message: 'Connection timeout' } });
      mockFrom.mockReturnValue(b);

      await expect(store.getRawData()).rejects.toThrow('getRawData: Connection timeout');
    });
  });

  describe('isTournamentProcessed', () => {
    it('returns true when standings count is greater than zero', async () => {
      const b = makeBuilder({ count: 3 });
      mockFrom.mockReturnValue(b);

      expect(await store.isTournamentProcessed('t1')).toBe(true);
    });

    it('returns false when standings count is zero', async () => {
      const b = makeBuilder({ count: 0 });
      mockFrom.mockReturnValue(b);

      expect(await store.isTournamentProcessed('t1')).toBe(false);
    });

    it('returns false when count is null', async () => {
      const b = makeBuilder({ count: null });
      mockFrom.mockReturnValue(b);

      expect(await store.isTournamentProcessed('t1')).toBe(false);
    });
  });

  describe('upsertTournament', () => {
    it('upserts with all provided fields', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.upsertTournament({
        id: 't1', name: 'Test', date: '2026-01-01', location: 'City',
        generation: 9, format: 'M-A', official: true,
      });

      expect(b.upsert).toHaveBeenCalledWith(
        { id: 't1', name: 'Test', date: '2026-01-01', location: 'City', generation: 9, format: 'M-A', official: true },
        { onConflict: 'id' },
      );
    });

    it('passes null location when location is null', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.upsertTournament({
        id: 't1', name: 'Test', date: '2026-01-01', location: null,
        generation: 9, format: 'M-A', official: false,
      });

      expect(b.upsert).toHaveBeenCalledWith(expect.objectContaining({ location: null }), expect.anything());
    });

    it('throws on upsert error', async () => {
      const b = makeBuilder({ error: { message: 'Write error' } });
      mockFrom.mockReturnValue(b);

      await expect(store.upsertTournament({
        id: 't1', name: 'Test', date: '2026-01-01', location: null, generation: 9, format: 'M-A', official: false,
      })).rejects.toThrow('upsertTournament: Write error');
    });
  });

  describe('findOrCreatePlayer', () => {
    it('returns existing player ID without inserting', async () => {
      const b = makeBuilder({ data: { id: 42 } });
      mockFrom.mockReturnValue(b);

      expect(await store.findOrCreatePlayer('Alice')).toBe(42);
      expect(b.insert).not.toHaveBeenCalled();
    });

    it('inserts and returns new player ID when not found', async () => {
      const selectBuilder = makeBuilder({ data: null });
      const insertBuilder = makeBuilder({ data: { id: 99 }, error: null });
      mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);

      expect(await store.findOrCreatePlayer('Bob', 'US')).toBe(99);
      expect(insertBuilder.insert).toHaveBeenCalledWith({ name: 'Bob', country: 'US' });
    });

    it('passes null country when country is not provided', async () => {
      const selectBuilder = makeBuilder({ data: null });
      const insertBuilder = makeBuilder({ data: { id: 7 }, error: null });
      mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);

      await store.findOrCreatePlayer('Charlie');

      expect(insertBuilder.insert).toHaveBeenCalledWith({ name: 'Charlie', country: null });
    });

    it('throws when insert fails', async () => {
      const selectBuilder = makeBuilder({ data: null });
      const insertBuilder = makeBuilder({ data: null, error: { message: 'Insert failed' } });
      mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);

      await expect(store.findOrCreatePlayer('Dave')).rejects.toThrow('findOrCreatePlayer: Insert failed');
    });
  });

  describe('findOrCreateTeam', () => {
    it('returns existing team ID without inserting', async () => {
      const b = makeBuilder({ data: { id: 10 } });
      mockFrom.mockReturnValue(b);

      expect(await store.findOrCreateTeam(1, 't1')).toBe(10);
      expect(b.insert).not.toHaveBeenCalled();
    });

    it('inserts and returns new team ID when not found', async () => {
      const selectBuilder = makeBuilder({ data: null });
      const insertBuilder = makeBuilder({ data: { id: 20 }, error: null });
      mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);

      expect(await store.findOrCreateTeam(1, 't1')).toBe(20);
      expect(insertBuilder.insert).toHaveBeenCalledWith({ player_id: 1, tournament_id: 't1' });
    });

    it('handles concurrent insert (23505) by fetching the existing row', async () => {
      const selectBuilder = makeBuilder({ data: null });
      const insertBuilder = makeBuilder({ data: null, error: { code: '23505', message: 'unique constraint' } });
      const refetchBuilder = makeBuilder({ data: { id: 55 } });
      mockFrom
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(refetchBuilder);

      expect(await store.findOrCreateTeam(1, 't1')).toBe(55);
    });

    it('throws on non-unique-constraint insert errors', async () => {
      const selectBuilder = makeBuilder({ data: null });
      const insertBuilder = makeBuilder({ data: null, error: { code: '42P01', message: 'Table not found' } });
      mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);

      await expect(store.findOrCreateTeam(1, 't1')).rejects.toThrow('findOrCreateTeam: Table not found');
    });
  });

  describe('insertPokemonSet', () => {
    it('inserts with all fields and returns the new ID', async () => {
      const b = makeBuilder({ data: { id: 5 }, error: null });
      mockFrom.mockReturnValue(b);

      const id = await store.insertPokemonSet({
        teamId: 1, species: 'Pikachu', item: 'Choice Band',
        ability: 'Static', tera_type: 'Electric', is_mega: false, invalid: false,
      });

      expect(id).toBe(5);
      expect(b.insert).toHaveBeenCalledWith({
        team_id: 1, species: 'Pikachu', item: 'Choice Band',
        ability: 'Static', tera_type: 'Electric', is_mega: false, invalid: false,
      });
    });

    it('maps null optional fields correctly', async () => {
      const b = makeBuilder({ data: { id: 6 }, error: null });
      mockFrom.mockReturnValue(b);

      await store.insertPokemonSet({ teamId: 1, species: 'Snorlax', is_mega: false, invalid: false });

      expect(b.insert).toHaveBeenCalledWith(
        expect.objectContaining({ item: null, ability: null, tera_type: null }),
      );
    });

    it('throws on insert error', async () => {
      const b = makeBuilder({ data: null, error: { message: 'FK violation' } });
      mockFrom.mockReturnValue(b);

      await expect(
        store.insertPokemonSet({ teamId: 1, species: 'Pikachu', is_mega: false, invalid: false }),
      ).rejects.toThrow('insertPokemonSet: FK violation');
    });
  });

  describe('insertMove', () => {
    it('inserts the move for the given pokemon set', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.insertMove(42, 'Thunderbolt');

      expect(mockFrom).toHaveBeenCalledWith('moves');
      expect(b.insert).toHaveBeenCalledWith({ pokemon_set_id: 42, move_name: 'Thunderbolt' });
    });

    it('throws on insert error', async () => {
      const b = makeBuilder({ error: { message: 'DB error' } });
      mockFrom.mockReturnValue(b);

      await expect(store.insertMove(1, 'Thunderbolt')).rejects.toThrow('insertMove: DB error');
    });
  });

  describe('insertMatch', () => {
    it('inserts match and returns the new ID', async () => {
      const b = makeBuilder({ data: { id: 3 }, error: null });
      mockFrom.mockReturnValue(b);

      const id = await store.insertMatch({ tournamentId: 't1', roundNumber: 2, tableNumber: 7, phase: 1 });

      expect(id).toBe(3);
      expect(b.insert).toHaveBeenCalledWith({
        tournament_id: 't1', round_number: 2, table_number: 7, phase: 1,
      });
    });

    it('passes null table number when not provided', async () => {
      const b = makeBuilder({ data: { id: 4 }, error: null });
      mockFrom.mockReturnValue(b);

      await store.insertMatch({ tournamentId: 't1', roundNumber: 1 });

      expect(b.insert).toHaveBeenCalledWith(expect.objectContaining({ table_number: null }));
    });

    it('throws on insert error', async () => {
      const b = makeBuilder({ data: null, error: { message: 'Insert failed' } });
      mockFrom.mockReturnValue(b);

      await expect(store.insertMatch({ tournamentId: 't1', roundNumber: 1 }))
        .rejects.toThrow('insertMatch: Insert failed');
    });
  });

  describe('upsertMatchParticipant', () => {
    it('upserts with correct fields and conflict target', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.upsertMatchParticipant({ matchId: 1, playerId: 2, teamId: 3, score: 1 });

      expect(b.upsert).toHaveBeenCalledWith(
        { match_id: 1, player_id: 2, team_id: 3, score: 1 },
        { onConflict: 'match_id,player_id' },
      );
    });

    it('throws on upsert error', async () => {
      const b = makeBuilder({ error: { message: 'Upsert failed' } });
      mockFrom.mockReturnValue(b);

      await expect(store.upsertMatchParticipant({ matchId: 1, playerId: 2, teamId: 3, score: 0 }))
        .rejects.toThrow('upsertMatchParticipant: Upsert failed');
    });
  });

  describe('upsertStanding', () => {
    it('upserts standing with all fields', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.upsertStanding({
        tournamentId: 't1', playerId: 1, teamId: 2,
        placing: 1, wins: 7, losses: 1, ties: 0, dropped: false,
      });

      expect(b.upsert).toHaveBeenCalledWith(
        {
          tournament_id: 't1', player_id: 1, team_id: 2,
          placing: 1, wins: 7, losses: 1, ties: 0, dropped: false,
        },
        { onConflict: 'tournament_id,player_id' },
      );
    });

    it('passes null placing when not provided', async () => {
      const b = makeBuilder({ error: null });
      mockFrom.mockReturnValue(b);

      await store.upsertStanding({
        tournamentId: 't1', playerId: 1, teamId: 2,
        placing: null, wins: 2, losses: 3, ties: 0, dropped: true,
      });

      expect(b.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ placing: null, dropped: true }),
        expect.anything(),
      );
    });

    it('throws on upsert error', async () => {
      const b = makeBuilder({ error: { message: 'Standing error' } });
      mockFrom.mockReturnValue(b);

      await expect(store.upsertStanding({
        tournamentId: 't1', playerId: 1, teamId: 2,
        placing: null, wins: 0, losses: 0, ties: 0, dropped: false,
      })).rejects.toThrow('upsertStanding: Standing error');
    });
  });

  describe('close', () => {
    it('is a no-op and does not throw', () => {
      expect(() => store.close()).not.toThrow();
    });
  });
});
