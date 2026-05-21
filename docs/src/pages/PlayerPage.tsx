import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { TeamIcons } from '../components/TeamIcons';
import './ProfilePage.css';

interface PlayerRow {
  id:           string;
  name:         string;
  country:      string;
  flag:         string;
  tournaments:  number;
  wins:         number;
  top_cuts:     number;
  best_placing: number;
  win_rate:     number;
}

interface ResultRow {
  tournament_id:   string;
  tournament_name: string;
  date:            string;
  placing:         number;
  wins:            number;
  losses:          number;
  team:            string[];
}

function pct(v: number) { return `${v.toFixed(1)}%`; }

function wrColor(v: number) {
  if (v >= 55) return 'var(--green)';
  if (v >= 50) return 'var(--text-h)';
  return 'var(--red)';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function placingLabel(p: number): string {
  if (p === 1) return '🥇 1st';
  if (p === 2) return '🥈 2nd';
  if (p === 3) return '🥉 3rd';
  return `${p}th`;
}

const SKEL_RESULT_WIDTHS = [70, 55, 80, 45, 65, 75, 50, 68, 58, 72];

export function PlayerPage() {
  const { id = '' } = useParams<{ id: string }>();

  const [player,        setPlayer]        = useState<PlayerRow | null>(null);
  const [results,       setResults]       = useState<ResultRow[]>([]);
  const [loadingPlayer, setLoadingPlayer] = useState(true);
  const [loadingRes,    setLoadingRes]    = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  // Fetch player stats
  useEffect(() => {
    setLoadingPlayer(true);
    supabase.rpc('get_players', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        const found = ((data ?? []) as PlayerRow[]).find(p => p.id === id) ?? null;
        setPlayer(found);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingPlayer(false));
  }, [id]);

  // Fetch career results
  useEffect(() => {
    setLoadingRes(true);
    supabase.rpc('get_player_career', { p_player_id: id })
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        const sorted = [...((data ?? []) as ResultRow[])].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        setResults(sorted);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingRes(false));
  }, [id]);

  return (
    <div className="list-page">
      <Link to="/players" className="back-link">
        <i className="bi bi-chevron-left" /> Players
      </Link>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      {error && <p className="list-page__error">{error}</p>}

      {loadingPlayer ? (
        <div style={{ marginBottom: 32 }}>
          <div className="skel skel--name" style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 24 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="skel skel--stat" />
            ))}
          </div>
        </div>
      ) : player ? (
        <div style={{ marginBottom: 32 }}>
          <h1 className="list-page__title" style={{ marginBottom: 6, fontSize: 32, letterSpacing: '-0.04em' }}>
            <span style={{ marginRight: 10 }}>{player.flag}</span>
            {player.name}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-4)', fontFamily: 'var(--font-ui)', marginBottom: 24 }}>
            {player.country}
          </p>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat__value">{player.tournaments}</span>
              <span className="profile-stat__label">Events</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{player.wins}</span>
              <span className="profile-stat__label">Wins</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{player.top_cuts}</span>
              <span className="profile-stat__label">Top Cuts</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{player.best_placing}</span>
              <span className="profile-stat__label">Best Place</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value" style={{ color: wrColor(player.win_rate) }}>
                {pct(player.win_rate)}
              </span>
              <span className="profile-stat__label">Win Rate</span>
            </div>
          </div>
        </div>
      ) : !error ? (
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Player not found.</p>
      ) : null}

      {/* ─── Results table ─────────────────────────────────────────────────── */}
      <div className="profile-section-label" style={{ marginBottom: 14 }}>Tournament Results</div>

      <table className="profile-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Tournament</th>
            <th className="right">Placing</th>
            <th className="right">Record</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          {loadingRes
            ? SKEL_RESULT_WIDTHS.map((w, i) => (
              <tr key={i} className="profile-skel-row" aria-hidden>
                <td><div className="skel" style={{ width: 80, height: 13 }} /></td>
                <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
                <td><div className="skel" style={{ width: 48, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 40, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: '80%', height: 13 }} /></td>
              </tr>
            ))
            : results.map((r, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-4)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDate(r.date)}
                  </span>
                </td>
                <td className="profile-table__name">
                  <Link to={`/tournaments/${r.tournament_id}`} className="cell-link">
                    {r.tournament_name}
                  </Link>
                </td>
                <td className="profile-table__num">
                  <span style={{ color: r.placing <= 3 ? 'var(--accent-2)' : 'var(--text-2)' }}>
                    {placingLabel(r.placing)}
                  </span>
                </td>
                <td className="profile-table__num">
                  <span style={{ color: 'var(--green)' }}>{r.wins}</span>
                  <span style={{ color: 'var(--text-4)', margin: '0 2px' }}>–</span>
                  <span style={{ color: 'var(--red)' }}>{r.losses}</span>
                </td>
                <td>
                  <TeamIcons team={r.team} pasteUrl="https://pokepast.es/6dbe083ec3d8afa2" />
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
