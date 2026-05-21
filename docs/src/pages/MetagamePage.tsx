import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { StatCards } from '../components/StatCards';
import './MetagamePage.css';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function pct(v: number) { return `${v.toFixed(1)}%`; }

function wrColor(v: number) {
  if (v >= 55) return 'var(--green)';
  if (v >= 50) return 'var(--text-h)';
  return 'var(--red)';
}

function WrChip({ value }: { value: number }) {
  const color = wrColor(value);
  return (
    <span className="mg-wr-chip" style={{ color, borderColor: color }}>
      {pct(value)}
    </span>
  );
}

// ─── Section A helpers ────────────────────────────────────────────────────────

interface PokemonUsageRow {
  species: string;
  usage_pct: number;
  win_rate: number;
}

interface MegaUsageRow {
  pokemon: string;
  usage_pct: number;
  win_rate: number;
  top_cut_usage: number;
}

interface TournamentRow {
  id: string;
  name: string;
  date: string;
  attendees: number;
  winner: string;
  winner_id: string;
}

// ─── Section B: Pokemon Usage Grid ────────────────────────────────────────────

function PokemonGrid() {
  const [rows, setRows] = useState<PokemonUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase.rpc('get_pokemon_usage', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setRows(((data ?? []) as PokemonUsageRow[]).slice(0, 9));
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="mg-section-error">{error}</p>;

  return (
    <div className="mg-pokemon-grid">
      {loading
        ? Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="mg-pokemon-card mg-pokemon-card--skel" aria-hidden>
              <div className="skel" style={{ width: '60%', height: 18, marginBottom: 10 }} />
              <div className="skel" style={{ width: '40%', height: 32, marginBottom: 8 }} />
              <div className="skel" style={{ width: 58, height: 22, borderRadius: 999 }} />
            </div>
          ))
        : rows.map(r => (
            <Link
              key={r.species}
              to={`/pokemon/${encodeURIComponent(r.species)}`}
              className="mg-pokemon-card"
            >
              <span className="mg-pokemon-card__name">{r.species}</span>
              <span className="mg-pokemon-card__usage">{pct(r.usage_pct)}</span>
              <WrChip value={r.win_rate} />
            </Link>
          ))
      }
    </div>
  );
}

// ─── Section C: Mega Meta Rank List ───────────────────────────────────────────

function MegaMetaList() {
  const [rows, setRows] = useState<MegaUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase.rpc('get_mega_usage', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setRows(((data ?? []) as MegaUsageRow[]).slice(0, 6));
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="mg-section-error">{error}</p>;

  return (
    <div className="mg-mega-list">
      {loading
        ? Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="mg-mega-row mg-mega-row--skel" aria-hidden>
              <div className="skel" style={{ width: 18, height: 13 }} />
              <div className="skel" style={{ width: `${40 + (i * 7) % 30}%`, height: 15 }} />
              <div className="skel mg-mega-row__bar-skel" style={{ height: 8 }} />
              <div className="skel" style={{ width: 48, height: 22, borderRadius: 999 }} />
              <div className="skel" style={{ width: 38, height: 13 }} />
            </div>
          ))
        : rows.map((r, i) => {
            const barWidth = Math.max(4, Math.min(100, r.usage_pct * 2));
            const color = wrColor(r.win_rate);
            return (
              <Link
                key={r.pokemon}
                to={`/mega/${encodeURIComponent(r.pokemon)}`}
                className="mg-mega-row"
              >
                <span className="mg-mega-row__rank">{i + 1}</span>
                <span className="mg-mega-row__name">{r.pokemon}</span>
                <div className="mg-mega-row__bar">
                  <div className="mg-mega-row__bar-fill" style={{ width: `${barWidth}%`, background: color }} />
                </div>
                <WrChip value={r.win_rate} />
                <span className="mg-mega-row__tc">Top-cut: {pct(r.top_cut_usage)}</span>
              </Link>
            );
          })
      }
    </div>
  );
}

// ─── Section D: Recent Events ─────────────────────────────────────────────────

function recentDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RecentEvents() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase.rpc('get_tournaments', {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        const sorted = [...((data ?? []) as TournamentRow[])].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        setRows(sorted.slice(0, 5));
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="mg-section-error">{error}</p>;

  return (
    <div className="mg-events-list">
      {loading
        ? Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="mg-event-row mg-event-row--skel" aria-hidden>
              <div className="skel" style={{ width: 52, height: 13 }} />
              <div className="skel" style={{ width: `${35 + (i * 11) % 30}%`, height: 15 }} />
              <div className="skel" style={{ width: 44, height: 22, borderRadius: 4 }} />
              <div className="skel" style={{ width: `${20 + (i * 9) % 20}%`, height: 13 }} />
            </div>
          ))
        : rows.map(r => (
            <div key={r.id} className="mg-event-row">
              <span className="mg-event-row__date">{recentDate(r.date)}</span>
              <Link to={`/tournaments/${r.id}`} className="mg-event-row__name cell-link">
                {r.name}
              </Link>
              <span className="mg-event-row__badge">{r.attendees.toLocaleString()} players</span>
              <Link to={`/players/${r.winner_id}`} className="mg-event-row__winner cell-link">
                {r.winner}
              </Link>
            </div>
          ))
      }
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MetagamePage() {
  return (
    <main className="mg-page">
      <StatCards />

      <div className="mg-body">
        <section className="mg-section">
          <div className="mg-section__header">
            <h2 className="mg-section__title">Pokemon Usage</h2>
            <Link to="/pokemon" className="mg-section__more">View all <i className="bi bi-arrow-right" /></Link>
          </div>
          <p className="mg-section__sub">Top 9 by usage across all M-A tournaments</p>
          <PokemonGrid />
        </section>

        <div className="mg-two-col">
          <section className="mg-section">
            <div className="mg-section__header">
              <h2 className="mg-section__title">Mega Meta</h2>
              <Link to="/mega" className="mg-section__more">View all <i className="bi bi-arrow-right" /></Link>
            </div>
            <p className="mg-section__sub">Top 6 mega stones by usage</p>
            <MegaMetaList />
          </section>

          <section className="mg-section">
            <div className="mg-section__header">
              <h2 className="mg-section__title">Recent Events</h2>
              <Link to="/tournaments" className="mg-section__more">View all <i className="bi bi-arrow-right" /></Link>
            </div>
            <p className="mg-section__sub">Latest 5 tournaments</p>
            <RecentEvents />
          </section>
        </div>
      </div>
    </main>
  );
}
