import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
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
  mega1:        string;
  mega2:        string;
  matches:      number;
  mega1_wins:   number;
  mega2_wins:   number;
  mega1_wr:     number;
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

function winRateColor(v: number): string {
  if (v >= 55) return '#4ade80';
  if (v >= 50) return '#c084fc';
  return '#f87171';
}

async function fetchMegaData(item: string) {
  const [usageRes, teammatesRes, h2hRes] = await Promise.all([
    supabase.rpc('get_mega_usage'),
    supabase.rpc('get_mega_teammates', { p_mega_item: item }),
    supabase.rpc('get_mega_h2h'),
  ]);

  const allUsage = (usageRes.data ?? []) as MegaStats[];
  const stats = allUsage.find(r => r.pokemon.toLowerCase() === item.toLowerCase()) ?? null;

  const allH2H = (h2hRes.data ?? []) as H2HRow[];
  const h2h = allH2H.filter(
    r => r.mega1.toLowerCase() === item.toLowerCase() ||
         r.mega2.toLowerCase() === item.toLowerCase()
  );

  // Normalise h2h so the queried item is always "mega1"
  const normalizedH2H = h2h.map(r => {
    if (r.mega1.toLowerCase() === item.toLowerCase()) return r;
    return {
      ...r,
      mega1:      r.mega2,
      mega2:      r.mega1,
      mega1_wins: r.mega2_wins,
      mega2_wins: r.mega1_wins,
      mega1_wr:   100 - r.mega1_wr,
    };
  });

  return {
    stats,
    teammates: (teammatesRes.data ?? []) as TeammateRow[],
    h2h: normalizedH2H,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="mega-stat-badge">
      <span className="mega-stat-badge__value">{value}</span>
      <span className="mega-stat-badge__label">{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MegaPage() {
  const { item } = useParams<{ item: string }>();
  const decoded = item ? decodeURIComponent(item) : '';

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [stats,     setStats]     = useState<MegaStats | null>(null);
  const [teammates, setTeammates] = useState<TeammateRow[]>([]);
  const [h2h,       setH2H]       = useState<H2HRow[]>([]);
  const [section,   setSection]   = useState<'teammates' | 'h2h'>('teammates');

  useEffect(() => {
    if (!decoded) return;
    setLoading(true);
    setError(null);
    fetchMegaData(decoded)
      .then(result => {
        setStats(result.stats);
        setTeammates(result.teammates);
        setH2H(result.h2h);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [decoded]);

  if (!decoded) {
    return (
      <div className="profile-page">
        <div className="profile-empty">No mega item selected.</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Link to="/" className="back-link">
        <i className="bi bi-arrow-left" /> Back to Metagame
      </Link>

      {/* Hero */}
      <div className="mega-hero">
        <div className="mega-hero__gem">
          <i className="bi bi-gem" aria-hidden="true" />
        </div>
        <div className="mega-hero__info">
          <h2 className="profile-title">{decoded}</h2>
          {stats && (
            <div className="mega-hero__stats">
              <StatBadge label="Usage"    value={pct(stats.usage_pct)} />
              <StatBadge label="Win Rate" value={pct(stats.win_rate)} />
              <StatBadge label="Teams"    value={stats.teams.toLocaleString()} />
            </div>
          )}
        </div>
      </div>

      {loading && <div className="mega-status">Loading...</div>}
      {error   && <div className="mega-status mega-error">{error}</div>}

      {!loading && !error && (
        <>
          {/* Section tabs */}
          <div className="mega-tabs">
            <button
              className={section === 'teammates' ? 'mega-tab active' : 'mega-tab'}
              onClick={() => setSection('teammates')}
            >
              Teammates
            </button>
            <button
              className={section === 'h2h' ? 'mega-tab active' : 'mega-tab'}
              onClick={() => setSection('h2h')}
            >
              Head-to-Head
            </button>
          </div>

          {section === 'teammates' && (
            <section className="mega-section">
              <h3 className="mega-section__title">Common Teammates</h3>
              {teammates.length === 0 ? (
                <p className="mega-section__empty">No teammate data available.</p>
              ) : (
                <table className="mega-table">
                  <thead>
                    <tr>
                      <th>Pokemon</th>
                      <th>Teams</th>
                      <th>Usage %</th>
                      <th>WR With</th>
                      <th>WR Without</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teammates.map((row, i) => (
                      <tr key={i} className="mega-table__row">
                        <td>
                          <Link to={`/pokemon/${encodeURIComponent(row.species)}`} className="cell-link">
                            {row.species}
                          </Link>
                        </td>
                        <td className="mega-table__num">{row.teams}</td>
                        <td className="mega-table__num">{pct(row.usage_pct)}</td>
                        <td className="mega-table__num" style={{ color: winRateColor(row.win_rate_with) }}>
                          {pct(row.win_rate_with)}
                        </td>
                        <td className="mega-table__num">{pct(row.win_rate_without)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {section === 'h2h' && (
            <section className="mega-section">
              <h3 className="mega-section__title">Head-to-Head vs Other Megas</h3>
              {h2h.length === 0 ? (
                <p className="mega-section__empty">No head-to-head data available.</p>
              ) : (
                <table className="mega-table">
                  <thead>
                    <tr>
                      <th>Opponent Mega</th>
                      <th>Matches</th>
                      <th>Wins</th>
                      <th>Opp Wins</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h
                      .sort((a, b) => b.mega1_wr - a.mega1_wr)
                      .map((row, i) => (
                        <tr key={i} className="mega-table__row">
                          <td>
                            <Link to={`/mega/${encodeURIComponent(row.mega2)}`} className="cell-link">
                              {row.mega2}
                            </Link>
                          </td>
                          <td className="mega-table__num">{row.matches}</td>
                          <td className="mega-table__num">{row.mega1_wins}</td>
                          <td className="mega-table__num">{row.mega2_wins}</td>
                          <td
                            className="mega-table__num mega-table__wr"
                            style={{ color: winRateColor(row.mega1_wr) }}
                          >
                            {pct(row.mega1_wr)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
