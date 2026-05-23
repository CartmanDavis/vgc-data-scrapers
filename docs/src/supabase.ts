/**
 * Supabase client with demo-mode fallback.
 * When VITE_SUPABASE_URL is configured and __DEMO_MODE__ is off, delegates to
 * the real Supabase client. Otherwise falls back to mock data.
 * Tests mock this module directly so the implementation doesn't matter to them.
 */

import { createClient } from '@supabase/supabase-js';
import {
  MOCK_TOURNAMENTS,
  MOCK_PLAYERS,
  MOCK_TOURNAMENT_STANDINGS,
  MOCK_PLAYER_RESULTS,
  MOCK_POKEMON_USAGE,
  MOCK_MEGA_USAGE,
  MOCK_MEGA_H2H,
  MOCK_MEGA_COMBOS,
  MOCK_MEGA_TEAMMATES,
  MOCK_POKEMON_MOVES,
  MOCK_POKEMON_ITEMS,
  MOCK_POKEMON_PARTNERS,
  MOCK_POKEMON_MATCHUPS,
  MOCK_METAGAME_SUMMARY,
  MOCK_POKEMON_TREND,
  MOCK_MEGA_TREND,
  MOCK_POKEMON_PLAYERS,
  MOCK_POKEMON_SPREADS,
  MOCK_NATURE_TRENDS,
} from './mock-data';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const _realClient = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;

type DemoMode = 'loaded' | 'loading' | 'error';

function mode(): DemoMode {
  return (window as unknown as { __DEMO_MODE__?: DemoMode }).__DEMO_MODE__ ?? 'loaded';
}

function resolve<T>(data: T) {
  const m = mode();
  if (m === 'loading') return new Promise<never>(() => { /* intentionally never resolves */ });
  if (m === 'error')   return Promise.resolve({ data: null, error: { message: 'Demo error: failed to connect to database.' }, count: null });
  return Promise.resolve({ data, error: null, count: Array.isArray(data) ? (data as unknown[]).length : null });
}

// ─── RPC dispatch ─────────────────────────────────────────────────────────────

function rpcData(fn: string, params?: Record<string, unknown>): unknown {
  switch (fn) {
    case 'get_metagame_summary': return MOCK_METAGAME_SUMMARY;
    case 'get_pokemon_usage':    return MOCK_POKEMON_USAGE;
    case 'get_mega_usage':       return MOCK_MEGA_USAGE;
    case 'get_mega_h2h':         return MOCK_MEGA_H2H;
    case 'get_mega_combos':      return MOCK_MEGA_COMBOS;
    case 'get_tournaments':      return MOCK_TOURNAMENTS;
    case 'get_players':          return MOCK_PLAYERS;
    case 'get_tournament_standings': {
      const id = String(params?.p_tournament_id ?? '');
      return MOCK_TOURNAMENT_STANDINGS[id] ?? MOCK_TOURNAMENT_STANDINGS.default;
    }
    case 'get_player_career': {
      const id = String(params?.p_player_id ?? '');
      return MOCK_PLAYER_RESULTS[id] ?? MOCK_PLAYER_RESULTS.default;
    }
    case 'get_mega_teammates': {
      const item = String(params?.p_mega_item ?? '');
      return MOCK_MEGA_TEAMMATES[item] ?? MOCK_MEGA_TEAMMATES.default;
    }
    case 'get_pokemon_moves': {
      const sp = String(params?.p_species ?? '');
      return MOCK_POKEMON_MOVES[sp] ?? MOCK_POKEMON_MOVES.default;
    }
    case 'get_pokemon_items': {
      const sp = String(params?.p_species ?? '');
      return MOCK_POKEMON_ITEMS[sp] ?? MOCK_POKEMON_ITEMS.default;
    }
    case 'get_pokemon_partners': {
      const sp = String(params?.p_species ?? '');
      return MOCK_POKEMON_PARTNERS[sp] ?? MOCK_POKEMON_PARTNERS.default;
    }
    case 'get_pokemon_matchups': {
      const sp = String(params?.p_species ?? '');
      return MOCK_POKEMON_MATCHUPS[sp] ?? MOCK_POKEMON_MATCHUPS.default;
    }
    case 'get_pokemon_trend': {
      const sp = String(params?.p_species ?? '');
      return MOCK_POKEMON_TREND[sp] ?? MOCK_POKEMON_TREND.default;
    }
    case 'get_mega_trend': {
      const item = String(params?.p_mega_item ?? '');
      return MOCK_MEGA_TREND[item] ?? MOCK_MEGA_TREND.default;
    }
    case 'get_pokemon_players': {
      const sp = String(params?.p_species ?? '');
      return MOCK_POKEMON_PLAYERS[sp] ?? MOCK_POKEMON_PLAYERS.default;
    }
    case 'get_pokemon_spreads': {
      const sp = String(params?.p_species ?? '');
      return MOCK_POKEMON_SPREADS[sp] ?? MOCK_POKEMON_SPREADS.default;
    }
    case 'get_nature_trends': {
      const sp = String(params?.p_species ?? '');
      const val = MOCK_NATURE_TRENDS[sp] ?? MOCK_NATURE_TRENDS.default;
      return Array.isArray(val) ? val : [];
    }
    case 'get_teams_with_rosters': return [];
    default: return [];
  }
}

// ─── Client (real or mock) ────────────────────────────────────────────────────

function isDemoMode(): boolean {
  if (!_realClient) return true;
  const m = (window as unknown as { __DEMO_MODE__?: DemoMode }).__DEMO_MODE__;
  return m === 'loading' || m === 'error';
}

export const supabase = {
  rpc: (fn: string, params?: Record<string, unknown>) => {
    if (isDemoMode()) return resolve(rpcData(fn, params));
    return _realClient!.rpc(fn, params ?? {});
  },

  from: (_table: string) => ({
    select: (_cols: string, _opts?: unknown) => ({
      eq: (_col: string, _val: string) => {
        if (isDemoMode()) {
          const m = mode();
          if (m === 'loading') return new Promise<never>(() => {});
          if (m === 'error')   return Promise.resolve({ data: null, count: null, error: { message: 'Demo error' } });
          return Promise.resolve({ data: MOCK_TOURNAMENTS, count: MOCK_TOURNAMENTS.length, error: null });
        }
        return _realClient!.from(_table).select(_cols, _opts as object).eq(_col, _val);
      },
    }),
  }),
};
