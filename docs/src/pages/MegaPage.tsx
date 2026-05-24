import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { TrendChart } from '../components/TrendChart';
import { ItemSprite } from '../components/ItemSprite';
import { PokemonIcon } from '../components/PokemonIcon';
import { applySort, toggleSort, SortTh } from '../components/SortableTable';
import { megaItemToPokemon } from '../utils/megaItems';
import type { TrendPoint } from '../mock-data';
import './ProfilePage.css';
import './MegaPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeammateRow {
  species:          string;
  teams:            number;
  usage_pct:        number;
  win_rate_with:    number;
  win_rate_without: number;
}

interface H2HRow {
  mega1:      string;
  mega2:      string;
  matches:    number;
  mega1_wins: number;
  mega2_wins: number;
  mega1_wr:   number;
}

interface MegaStats {
  pokemon:   string;
  teams:     number;
  usage_pct: number;
  win_rate:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function wrColor(v: number): string {
  if (v >= 55) return 'var(--green)';
  if (v >= 50) return 'var(--text-h)';
  return 'var(--red)';
}

async function fetchMegaData(item: string) {
  const [usageRes, teammatesRes, h2hRes, trendRes] = await Promise.all([
    supabase.rpc('get_mega_usage'),
    supabase.rpc('get_mega_teammates', { p_mega_item: item }),
    supabase.rpc('get_mega_h2h'),
    supabase.rpc('get_mega_trend', { p_mega_item: item }),
  ]);

  const firstError = [usageRes, teammatesRes, h2hRes, trendRes].find(r => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const allUsage = (usageRes.data ?? []) as MegaStats[];
  const stats    = allUsage.find(r => r.pokemon.toLowerCase() === item.toLowerCase()) ?? null;

  const allH2H = (h2hRes.data ?? []) as H2HRow[];
  const h2h    = allH2H
    .filter(r =>
      r.mega1.toLowerCase() === item.toLowerCase() ||
      r.mega2.toLowerCase() === item.toLowerCase()
    )
    .map(r => {
      if (r.mega1.toLowerCase() === item.toLowerCase()) return r;
      return { ...r, mega1: r.mega2, mega2: r.mega1, mega1_wins: r.mega2_wins, mega2_wins: r.mega1_wins, mega1_wr: 100 - r.mega1_wr };
    });

  return { stats, teammates: (teammatesRes.data ?? []) as TeammateRow[], h2h, trend: (trendRes.data ?? []) as TrendPoint[] };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MegaPage() {
  const { item } = useParams<{ item: string }>();
  const decoded  = item ? decodeURIComponent(item) : '';

  type TeammateSortCol = 'teams' | 'usage_pct' | 'win_rate_with' | 'win_rate_without';
  type H2HSortCol = 'matches' | 'mega1_wins' | 'mega2_wins' | 'mega1_wr';

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [stats,         setStats]         = useState<MegaStats | null>(null);
  const [teammates,     setTeammates]     = useState<TeammateRow[]>([]);
  const [h2h,           setH2H]           = useState<H2HRow[]>([]);
  const [trend,         setTrend]         = useState<TrendPoint[]>([]);
  const [tab,           setTab]           = useState<'teammates' | 'h2h' | 'trends'>('teammates');
  const [teammateSort,  setTeammateSort]  = useState<{ col: TeammateSortCol; dir: 'asc' | 'desc' }>({ col: 'usage_pct', dir: 'desc' });
  const [h2hSort,       setH2HSort]       = useState<{ col: H2HSortCol; dir: 'asc' | 'desc' }>({ col: 'mega1_wr', dir: 'desc' });

  useEffect(() => {
    if (!decoded) return;
    setLoading(true);
    setError(null);
    fetchMegaData(decoded)
      .then(d => { setStats(d.stats); setTeammates(d.teammates); setH2H(d.h2h); setTrend(d.trend); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [decoded]);

  if (!decoded) {
    return <div className="profile-page"><div className="profile-empty">No mega item selected.</div></div>;
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-hero">
          <div className="profile-hero__content">
            <div className="skel skel--back" />
            <div className="skel skel--name" />
            <div className="profile-stats">
              {[0, 1, 2].map(i => <div key={i} className="skel skel--stat" />)}
            </div>
          </div>
        </div>
        <div className="profile-tabs">
          <button className="profile-tab" disabled>Teammates</button>
          <button className="profile-tab" disabled>Head-to-Head</button>
          <button className="profile-tab" disabled>Trends</button>
        </div>
        <div className="profile-body">
          <div className="skel skel--heading" />
          <table className="profile-table"><thead><tr>
            <th>Pokémon</th><th>Teams</th><th>Usage</th><th>WR With</th><th>WR Without</th>
          </tr></thead><tbody>
            {Array.from({ length: 10 }, (_, i) => (
              <tr key={i} className="profile-skel-row" aria-hidden>
                <td><div className="skel" style={{ width: `${40 + (i * 17) % 40}%`, height: 14 }} /></td>
                <td><div className="skel" style={{ width: 36, height: 14, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 44, height: 14, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 44, height: 14, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 44, height: 14, marginLeft: 'auto' }} /></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-hero">
          <div className="profile-hero__content">
            <Link to="/mega" className="back-link"><i className="bi bi-arrow-left" /> All Mega Items</Link>
            <h2 className="profile-name" style={{ color: 'var(--red)' }}>Failed to load</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-ui)', marginTop: 8 }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* ── Hero ── */}
      <div className="profile-hero">
        <div className="mega-gem-glow" />
        <div className="mega-gem-art">
          <ItemSprite item={decoded} size={96} />
        </div>
        <div className="profile-hero__content">
          <Link to="/mega" className="back-link"><i className="bi bi-arrow-left" /> All Mega Items</Link>
          <h2 className="profile-name">{megaItemToPokemon(decoded)}</h2>
          {stats && (
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat__value">{pct(stats.usage_pct)}</span>
                <span className="profile-stat__label">Usage</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat__value" style={{ color: wrColor(stats.win_rate) }}>{pct(stats.win_rate)}</span>
                <span className="profile-stat__label">Win Rate</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat__value">{stats.teams.toLocaleString()}</span>
                <span className="profile-stat__label">Teams</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="profile-tabs">
        <button className={`profile-tab${tab === 'teammates' ? ' active' : ''}`} onClick={() => setTab('teammates')}>
          Teammates
        </button>
        <button className={`profile-tab${tab === 'h2h' ? ' active' : ''}`} onClick={() => setTab('h2h')}>
          Head-to-Head
        </button>
        <button className={`profile-tab${tab === 'trends' ? ' active' : ''}`} onClick={() => setTab('trends')}>
          Trends
        </button>
      </div>

      {/* ── Content ── */}
      <div className="profile-body">
        {tab === 'teammates' && (
          <>
            <p className="profile-section-label">Common Teammates</p>
            <table className="profile-table mega-table">
              <thead><tr>
                <th>Pokémon</th>
                <SortTh label="Teams"      active={teammateSort.col === 'teams'}            dir={teammateSort.dir} onClick={() => toggleSort('teams',            teammateSort, setTeammateSort)} className="right" />
                <SortTh label="Usage"      active={teammateSort.col === 'usage_pct'}        dir={teammateSort.dir} onClick={() => toggleSort('usage_pct',        teammateSort, setTeammateSort)} className="right" />
                <SortTh label="WR With"    active={teammateSort.col === 'win_rate_with'}    dir={teammateSort.dir} onClick={() => toggleSort('win_rate_with',    teammateSort, setTeammateSort)} className="right" />
                <SortTh label="WR Without" active={teammateSort.col === 'win_rate_without'} dir={teammateSort.dir} onClick={() => toggleSort('win_rate_without', teammateSort, setTeammateSort)} className="right" />
              </tr></thead>
              <tbody>
                {teammates.length === 0
                  ? <tr><td colSpan={5} className="profile-no-data">No data available.</td></tr>
                  : applySort(teammates, teammateSort.col, teammateSort.dir).map((r, i) => (
                    <tr key={i}>
                      <td className="profile-table__name">
                        <Link to={`/pokemon/${encodeURIComponent(r.species)}`} className="cell-link">
                          <PokemonIcon species={r.species} size="small" style={{ width: 24, height: 24, marginRight: 6, verticalAlign: 'middle' }} />
                          {r.species}
                        </Link>
                      </td>
                      <td className="profile-table__num">{r.teams}</td>
                      <td className="profile-table__num">{pct(r.usage_pct)}</td>
                      <td className="profile-table__num" style={{ color: wrColor(r.win_rate_with), fontWeight: 600 }}>
                        {pct(r.win_rate_with)}
                      </td>
                      <td className="profile-table__num">{pct(r.win_rate_without)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        {tab === 'h2h' && (
          <>
            <p className="profile-section-label">Head-to-Head vs Other Megas</p>
            <table className="profile-table mega-table">
              <thead><tr>
                <th>Opponent Mega</th>
                <SortTh label="Matches"  active={h2hSort.col === 'matches'}    dir={h2hSort.dir} onClick={() => toggleSort('matches',    h2hSort, setH2HSort)} className="right" />
                <SortTh label="Wins"     active={h2hSort.col === 'mega1_wins'} dir={h2hSort.dir} onClick={() => toggleSort('mega1_wins', h2hSort, setH2HSort)} className="right" />
                <SortTh label="Opp Wins" active={h2hSort.col === 'mega2_wins'} dir={h2hSort.dir} onClick={() => toggleSort('mega2_wins', h2hSort, setH2HSort)} className="right" />
                <SortTh label="Win Rate" active={h2hSort.col === 'mega1_wr'}   dir={h2hSort.dir} onClick={() => toggleSort('mega1_wr',   h2hSort, setH2HSort)} className="right" />
              </tr></thead>
              <tbody>
                {h2h.length === 0
                  ? <tr><td colSpan={5} className="profile-no-data">No data available.</td></tr>
                  : applySort(h2h, h2hSort.col, h2hSort.dir).map((r, i) => (
                      <tr key={i}>
                        <td className="profile-table__name">
                          <Link to={`/mega/${encodeURIComponent(r.mega2)}`} className="cell-link">
                            <ItemSprite item={r.mega2} size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            {megaItemToPokemon(r.mega2)}
                          </Link>
                        </td>
                        <td className="profile-table__num">{r.matches}</td>
                        <td className="profile-table__num">{r.mega1_wins}</td>
                        <td className="profile-table__num">{r.mega2_wins}</td>
                        <td className="profile-table__num" style={{ color: wrColor(r.mega1_wr), fontWeight: 600 }}>
                          {pct(r.mega1_wr)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </>
        )}

        {tab === 'trends' && (
          trend.length > 0
            ? <TrendChart data={trend} name={decoded} />
            : <p className="profile-no-data" style={{ padding: '32px 0' }}>No trend data available.</p>
        )}
      </div>
    </div>
  );
}
