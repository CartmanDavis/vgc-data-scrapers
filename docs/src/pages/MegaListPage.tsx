import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { ItemSprite } from '../components/ItemSprite';
import './ProfilePage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MegaRow {
  pokemon:        string;
  teams:          number;
  usage_pct:      number;
  win_rate:       number;
  top_cut_usage:  number;
  top_cut_wr:     number;
}

interface H2HRow {
  mega1:      string;
  mega2:      string;
  matches:    number;
  mega1_wins: number;
  mega2_wins: number;
  mega1_wr:   number;
}

interface ComboRow {
  combo:          string;
  teams:          number;
  usage_pct:      number;
  win_rate:       number;
  top_cut_teams:  number;
  top_cut_wr:     number;
}

type TabId = 'usage' | 'h2h' | 'combos';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) { return `${v.toFixed(1)}%`; }

function wrColor(v: number) {
  if (v >= 55) return 'var(--green)';
  if (v >= 50) return 'var(--text-h)';
  return 'var(--red)';
}

function WinRateBar({ value }: { value: number }) {
  return (
    <span className="wr-text" style={{ color: wrColor(value) }}>{pct(value)}</span>
  );
}

const SKEL_WIDTHS = [58, 70, 45, 63, 77, 52, 66, 48, 72, 55];

// ─── Usage tab ────────────────────────────────────────────────────────────────

function UsageTab() {
  const [rows,    setRows]    = useState<MegaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc('get_mega_usage', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setRows((data ?? []) as MegaRow[]);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    search ? rows.filter(r => r.pokemon.toLowerCase().includes(search.toLowerCase())) : rows,
  [rows, search]);

  return (
    <>
      {!loading && !error && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <input
            className="list-page__search"
            placeholder="Search mega items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}
      {error && <p className="list-page__error">{error}</p>}
      <table className="profile-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Mega Item</th>
            <th className="right">Teams</th>
            <th className="right">Usage %</th>
            <th style={{ minWidth: 160 }}>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? SKEL_WIDTHS.map((w, i) => (
              <tr key={i} className="profile-skel-row" aria-hidden>
                <td><div className="skel" style={{ width: 20, height: 13 }} /></td>
                <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
                <td><div className="skel" style={{ width: 38, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ width: 46, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ height: 22 }} /></td>
              </tr>
            ))
            : filtered.map((r, i) => (
              <tr key={r.pokemon}>
                <td className="profile-table__num">{i + 1}</td>
                <td className="profile-table__name">
                  <Link to={`/mega/${encodeURIComponent(r.pokemon)}`} className="cell-link">
                    <ItemSprite item={r.pokemon} size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {r.pokemon}
                  </Link>
                </td>
                <td className="profile-table__num">{r.teams.toLocaleString()}</td>
                <td className="profile-table__num">{pct(r.usage_pct)}</td>
                <td><WinRateBar value={r.win_rate} /></td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </>
  );
}

// ─── H2H tab ──────────────────────────────────────────────────────────────────

const H2H_SKEL = [72, 55, 68, 48, 80, 61, 44];

function H2HTab() {
  const [rows,    setRows]    = useState<H2HRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc('get_mega_h2h', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setRows((data ?? []) as H2HRow[]);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="list-page__error">{error}</p>;

  return (
    <table className="profile-table">
      <thead>
        <tr>
          <th>Mega 1</th>
          <th>Mega 2</th>
          <th className="right">Matches</th>
          <th className="right">M1 Wins</th>
          <th className="right">M2 Wins</th>
          <th style={{ minWidth: 160 }}>M1 Win Rate</th>
        </tr>
      </thead>
      <tbody>
        {loading
          ? H2H_SKEL.map((w, i) => (
            <tr key={i} className="profile-skel-row" aria-hidden>
              <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
              <td><div className="skel" style={{ width: `${(w + 15) % 50 + 40}%`, height: 15 }} /></td>
              <td><div className="skel" style={{ width: 40, height: 13, marginLeft: 'auto' }} /></td>
              <td><div className="skel" style={{ width: 36, height: 13, marginLeft: 'auto' }} /></td>
              <td><div className="skel" style={{ width: 36, height: 13, marginLeft: 'auto' }} /></td>
              <td><div className="skel" style={{ height: 22 }} /></td>
            </tr>
          ))
          : rows.map((r, i) => (
            <tr key={i}>
              <td className="profile-table__name">
                <Link to={`/mega/${encodeURIComponent(r.mega1)}`} className="cell-link">
                  <ItemSprite item={r.mega1} size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  {r.mega1}
                </Link>
              </td>
              <td className="profile-table__name">
                <Link to={`/mega/${encodeURIComponent(r.mega2)}`} className="cell-link">
                  <ItemSprite item={r.mega2} size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  {r.mega2}
                </Link>
              </td>
              <td className="profile-table__num">{r.matches.toLocaleString()}</td>
              <td className="profile-table__num">{r.mega1_wins.toLocaleString()}</td>
              <td className="profile-table__num">{r.mega2_wins.toLocaleString()}</td>
              <td><WinRateBar value={r.mega1_wr} /></td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}

// ─── Combos tab ───────────────────────────────────────────────────────────────

const COMBO_SKEL = [65, 80, 55, 72, 48];

function CombosTab() {
  const [rows,    setRows]    = useState<ComboRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc('get_mega_combos', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setRows((data ?? []) as ComboRow[]);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="list-page__error">{error}</p>;

  return (
    <table className="profile-table">
      <thead>
        <tr>
          <th>Combo</th>
          <th className="right">Teams</th>
          <th className="right">Usage %</th>
          <th style={{ minWidth: 160 }}>Win Rate</th>
          <th className="right">Top-cut</th>
          <th className="right">TC WR</th>
        </tr>
      </thead>
      <tbody>
        {loading
          ? COMBO_SKEL.map((w, i) => (
            <tr key={i} className="profile-skel-row" aria-hidden>
              <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
              <td><div className="skel" style={{ width: 38, height: 13, marginLeft: 'auto' }} /></td>
              <td><div className="skel" style={{ width: 46, height: 13, marginLeft: 'auto' }} /></td>
              <td><div className="skel" style={{ height: 22 }} /></td>
              <td><div className="skel" style={{ width: 36, height: 13, marginLeft: 'auto' }} /></td>
              <td><div className="skel" style={{ width: 46, height: 13, marginLeft: 'auto' }} /></td>
            </tr>
          ))
          : rows.map((r, i) => (
            <tr key={i}>
              <td className="profile-table__name">{r.combo}</td>
              <td className="profile-table__num">{r.teams.toLocaleString()}</td>
              <td className="profile-table__num">{pct(r.usage_pct)}</td>
              <td><WinRateBar value={r.win_rate} /></td>
              <td className="profile-table__num">{r.top_cut_teams.toLocaleString()}</td>
              <td className="profile-table__num" style={{ color: wrColor(r.top_cut_wr) }}>{pct(r.top_cut_wr)}</td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'usage',  label: 'Usage'  },
  { id: 'h2h',    label: 'Head-to-Head' },
  { id: 'combos', label: 'Combos' },
];

export function MegaListPage() {
  const [tab, setTab] = useState<TabId>('usage');

  return (
    <div className="list-page">
      <div className="list-page__header">
        <div>
          <h1 className="list-page__title">Mega Items</h1>
          <p className="list-page__subtitle">Mega stone usage across all M-A tournaments</p>
        </div>
      </div>

      <div className="profile-tabs" style={{ marginBottom: 24, marginLeft: -4 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`profile-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'usage'  && <UsageTab />}
      {tab === 'h2h'    && <H2HTab />}
      {tab === 'combos' && <CombosTab />}
    </div>
  );
}
