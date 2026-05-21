import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import './ProfilePage.css';

interface TournamentRow {
  id:        string;
  name:      string;
  date:      string;
  format:    string;
  attendees: number;
  winner:    string;
  winner_id: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type TournamentType = 'worlds' | 'intl' | 'regional' | 'online';

function getTournamentType(name: string): TournamentType {
  const n = name.toLowerCase();
  if (n.includes('world championship')) return 'worlds';
  if (n.startsWith('international')) return 'intl';
  if (n.includes('regional')) return 'regional';
  return 'online';
}

const TYPE_BADGE: Record<TournamentType, React.ReactNode | null> = {
  worlds: (
    <span style={{
      fontSize: 10,
      fontWeight: 800,
      fontFamily: 'var(--font-ui)',
      color: '#fbbf24',
      background: 'rgba(251, 191, 36, 0.12)',
      border: '1px solid rgba(251, 191, 36, 0.35)',
      borderRadius: 4,
      padding: '1px 7px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      boxShadow: '0 0 8px rgba(251, 191, 36, 0.25)',
    }}>Worlds</span>
  ),
  intl: (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      fontFamily: 'var(--font-ui)',
      color: 'var(--accent-2)',
      background: 'var(--accent-bg)',
      border: '1px solid var(--accent-border)',
      borderRadius: 4,
      padding: '1px 6px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>INTL</span>
  ),
  regional: (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      fontFamily: 'var(--font-ui)',
      color: 'var(--text-3)',
      background: 'var(--surface-2)',
      border: '1px solid var(--border-2)',
      borderRadius: 4,
      padding: '1px 6px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>REG</span>
  ),
  online: null,
};

const SKEL_WIDTHS = [62, 80, 54, 71, 48, 66, 75, 52, 68, 44, 79, 57];

export function TournamentsPage() {
  const [rows,    setRows]    = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc('get_tournaments', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        const sorted = [...((data ?? []) as TournamentRow[])].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        setRows(sorted);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="list-page">
      <div className="list-page__header">
        <div>
          <h1 className="list-page__title">Tournaments</h1>
          <p className="list-page__subtitle">All M-A format events</p>
        </div>
      </div>

      {error && <p className="list-page__error">{error}</p>}

      <table className="profile-table profile-table--tournaments">
        <thead>
          <tr>
            <th>Date</th>
            <th>Tournament</th>
            <th className="right">Attendees</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? SKEL_WIDTHS.map((w, i) => (
              <tr key={i} className="profile-skel-row" aria-hidden>
                <td><div className="skel" style={{ width: 80, height: 13 }} /></td>
                <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
                <td><div className="skel" style={{ width: 44, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: '50%', height: 13 }} /></td>
              </tr>
            ))
            : rows.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDate(r.date)}
                  </span>
                </td>
                <td className="profile-table__name">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link to={`/tournaments/${r.id}`} className="cell-link">{r.name}</Link>
                    {TYPE_BADGE[getTournamentType(r.name)]}
                  </div>
                </td>
                <td className="profile-table__num">{r.attendees.toLocaleString()}</td>
                <td>
                  <Link to={`/players/${r.winner_id}`} className="cell-link" style={{ fontWeight: 500 }}>
                    {r.winner}
                  </Link>
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
