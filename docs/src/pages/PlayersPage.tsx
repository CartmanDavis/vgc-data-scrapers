import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
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

function pct(v: number) { return `${v.toFixed(1)}%`; }

function wrColor(v: number) {
  if (v >= 55) return 'var(--green)';
  if (v >= 50) return 'var(--text-h)';
  return 'var(--red)';
}

const SKEL_WIDTHS = [68, 54, 78, 45, 72, 60, 83, 50, 65, 75, 48, 70, 55, 80, 52, 66, 73, 58];

export function PlayersPage() {
  const [rows,    setRows]    = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc('get_players', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        const sorted = [...((data ?? []) as PlayerRow[])].sort((a, b) => b.wins - a.wins || b.top_cuts - a.top_cuts);
        setRows(sorted);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="list-page">
      <div className="list-page__header">
        <div>
          <h1 className="list-page__title">Players</h1>
          <p className="list-page__subtitle">M-A format leaderboard — sorted by tournament wins</p>
        </div>
      </div>

      {error && <p className="list-page__error">{error}</p>}

      <table className="profile-table profile-table--players">
        <thead>
          <tr>
            <th style={{ width: 36 }}>Rank</th>
            <th>Player</th>
            <th>Country</th>
            <th className="right">Events</th>
            <th className="right">Wins</th>
            <th className="right">Top Cuts</th>
            <th className="right">Best</th>
            <th className="right">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? SKEL_WIDTHS.map((w, i) => (
              <tr key={i} className="profile-skel-row" aria-hidden>
                <td><div className="skel" style={{ width: 20, height: 13 }} /></td>
                <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
                <td><div className="skel" style={{ width: 90, height: 13 }} /></td>
                <td><div className="skel" style={{ width: 30, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 26, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 34, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 26, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 46, height: 13, marginLeft: 'auto' }} /></td>
              </tr>
            ))
            : rows.map((r, i) => (
              <tr key={r.id}>
                <td className="profile-table__num">{i + 1}</td>
                <td className="profile-table__name">
                  <Link to={`/players/${r.id}`} className="cell-link">{r.name}</Link>
                </td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
                    <span style={{ fontSize: 16 }}>{r.flag}</span>
                    {r.country}
                  </span>
                </td>
                <td className="profile-table__num">{r.tournaments}</td>
                <td className="profile-table__num" style={{ fontWeight: 700 }}>{r.wins}</td>
                <td className="profile-table__num">{r.top_cuts}</td>
                <td className="profile-table__num">{r.best_placing}</td>
                <td className="profile-table__num" style={{ color: wrColor(r.win_rate) }}>
                  {pct(r.win_rate)}
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
