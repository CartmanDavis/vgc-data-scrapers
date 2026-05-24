import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { ItemSprite } from '../components/ItemSprite';
import { applySort, toggleSort, SortTh } from '../components/SortableTable';
import { megaItemToPokemon } from '../utils/megaItems';
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

type UsageSortCol = 'pokemon_name' | 'usage_pct' | 'win_rate';

function UsageTab() {
  const [rows,    setRows]    = useState<MegaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [sort,    setSort]    = useState<{ col: UsageSortCol; dir: 'asc' | 'desc' }>({ col: 'usage_pct', dir: 'desc' });

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

  const withNames = useMemo(() =>
    rows.map(r => ({ ...r, pokemon_name: megaItemToPokemon(r.pokemon) })),
  [rows]);

  const filtered = useMemo(() =>
    search ? withNames.filter(r => r.pokemon_name.toLowerCase().includes(search.toLowerCase())) : withNames,
  [withNames, search]);

  const sorted = applySort(filtered, sort.col, sort.dir);

  return (
    <>
      {!loading && !error && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <input
            className="list-page__search"
            placeholder="Search mega pokemon…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}
      {error && <p className="list-page__error">{error}</p>}
      <table className="profile-table">
        <thead>
          <tr>
            <SortTh label="Pokémon"  active={sort.col === 'pokemon_name'} dir={sort.dir} onClick={() => toggleSort('pokemon_name', sort, setSort)} />
            <SortTh label="Usage %"  active={sort.col === 'usage_pct'}    dir={sort.dir} onClick={() => toggleSort('usage_pct',    sort, setSort)} className="right" />
            <SortTh label="Win Rate" active={sort.col === 'win_rate'}     dir={sort.dir} onClick={() => toggleSort('win_rate',     sort, setSort)} className="right" />
          </tr>
        </thead>
        <tbody>
          {loading
            ? SKEL_WIDTHS.map((w, i) => (
              <tr key={i} className="profile-skel-row" aria-hidden>
                <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
                <td><div className="skel" style={{ width: 46, height: 13, marginLeft: 'auto' }} /></td>
                <td><div className="skel" style={{ height: 22 }} /></td>
              </tr>
            ))
            : sorted.map((r) => (
              <tr key={r.pokemon}>
                <td className="profile-table__name">
                  <Link to={`/mega/${encodeURIComponent(r.pokemon)}`} className="cell-link">
                    <ItemSprite item={r.pokemon} size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {r.pokemon_name}
                  </Link>
                </td>
                <td className="profile-table__num">{pct(r.usage_pct)}</td>
                <td className="profile-table__num"><WinRateBar value={r.win_rate} /></td>
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

interface FlatH2HRow { mega: string; mega_name: string; opponent: string; win_rate: number; }

type H2HSortCol = 'mega_name' | 'win_rate';

function H2HTab() {
  const [rows,    setRows]    = useState<H2HRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sort,    setSort]    = useState<{ col: H2HSortCol; dir: 'asc' | 'desc' }>({ col: 'win_rate', dir: 'desc' });

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

  const expanded: FlatH2HRow[] = [];
  for (const r of rows) {
    expanded.push({ mega: r.mega1, mega_name: megaItemToPokemon(r.mega1), opponent: r.mega2, win_rate: r.mega1_wr });
    expanded.push({ mega: r.mega2, mega_name: megaItemToPokemon(r.mega2), opponent: r.mega1, win_rate: 100 - r.mega1_wr });
  }
  const sorted = applySort(expanded, sort.col, sort.dir);

  return (
    <table className="profile-table">
      <thead>
        <tr>
          <SortTh label="Pokémon"  active={sort.col === 'mega_name'} dir={sort.dir} onClick={() => toggleSort('mega_name', sort, setSort)} />
          <th>Opponent</th>
          <SortTh label="Win Rate" active={sort.col === 'win_rate'}  dir={sort.dir} onClick={() => toggleSort('win_rate',  sort, setSort)} className="right" />
        </tr>
      </thead>
      <tbody>
        {loading
          ? H2H_SKEL.map((w, i) => (
            <tr key={i} className="profile-skel-row" aria-hidden>
              <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
              <td><div className="skel" style={{ width: `${(w + 15) % 50 + 40}%`, height: 15 }} /></td>
              <td><div className="skel" style={{ height: 22 }} /></td>
            </tr>
          ))
          : sorted.map((r, i) => (
            <tr key={i}>
              <td className="profile-table__name">
                <Link to={`/mega/${encodeURIComponent(r.mega)}`} className="cell-link">
                  <ItemSprite item={r.mega} size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  {r.mega_name}
                </Link>
              </td>
              <td className="profile-table__name">
                <Link to={`/mega/${encodeURIComponent(r.opponent)}`} className="cell-link">
                  <ItemSprite item={r.opponent} size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  {megaItemToPokemon(r.opponent)}
                </Link>
              </td>
              <td className="profile-table__num"><WinRateBar value={r.win_rate} /></td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}

// ─── Combos tab ───────────────────────────────────────────────────────────────

const COMBO_SKEL = [65, 80, 55, 72, 48];

type ComboSortCol = 'usage_pct' | 'win_rate' | 'top_cut_wr';

function CombosTab() {
  const [rows,    setRows]    = useState<ComboRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sort,    setSort]    = useState<{ col: ComboSortCol; dir: 'asc' | 'desc' }>({ col: 'usage_pct', dir: 'desc' });

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

  const sorted = applySort(rows, sort.col, sort.dir);

  return (
    <table className="profile-table">
      <thead>
        <tr>
          <th>Combo</th>
          <SortTh label="Usage %"  active={sort.col === 'usage_pct'} dir={sort.dir} onClick={() => toggleSort('usage_pct', sort, setSort)} className="right" />
          <SortTh label="Win Rate" active={sort.col === 'win_rate'}  dir={sort.dir} onClick={() => toggleSort('win_rate',  sort, setSort)} className="right" />
          <SortTh label="TC WR"    active={sort.col === 'top_cut_wr'} dir={sort.dir} onClick={() => toggleSort('top_cut_wr', sort, setSort)} className="right" />
        </tr>
      </thead>
      <tbody>
        {loading
          ? COMBO_SKEL.map((w, i) => (
            <tr key={i} className="profile-skel-row" aria-hidden>
              <td><div className="skel" style={{ width: `${w}%`, height: 15 }} /></td>
              <td><div className="skel" style={{ width: 46, height: 13, marginLeft: 'auto' }} /></td>
              <td><div className="skel" style={{ height: 22 }} /></td>
              <td><div className="skel" style={{ width: 46, height: 13, marginLeft: 'auto' }} /></td>
            </tr>
          ))
          : sorted.map((r, i) => (
            <tr key={i}>
              <td className="profile-table__name">{r.combo}</td>
              <td className="profile-table__num">{pct(r.usage_pct)}</td>
              <td className="profile-table__num"><WinRateBar value={r.win_rate} /></td>
              <td className="profile-table__num" style={{ color: r.top_cut_wr != null ? wrColor(r.top_cut_wr) : undefined }}>{r.top_cut_wr != null ? pct(r.top_cut_wr) : '—'}</td>
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
