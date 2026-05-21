import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { StatCards } from '../components/StatCards';
import './MetagamePage.css';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function pct(v: number) { return `${v.toFixed(1)}%`; }

// ─── Data types ───────────────────────────────────────────────────────────────

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

interface MegaComboRow {
  combo: string;
  usage_pct: number;
  win_rate: number;
}

interface MegaH2HRow {
  mega1: string;
  mega2: string;
  mega1_wr: number;
  matches: number;
}

interface TournamentRow {
  id: string;
  name: string;
  date: string;
  attendees: number;
  winner: string;
  winner_id: string;
}

// ─── Insight cards ────────────────────────────────────────────────────────────

interface InsightDef {
  category: string;
  icon: string;
  color: string;
  subject: string;
  stat: string;
  href: string;
}

function computeInsights(
  megaRows: MegaUsageRow[],
  pokemonRows: PokemonUsageRow[],
  comboRows: MegaComboRow[],
  h2hRows: MegaH2HRow[],
): InsightDef[] {
  const out: InsightDef[] = [];

  const topMega = megaRows[0];
  if (topMega) {
    out.push({
      category: 'Meta Leader',
      icon: 'bi-trophy-fill',
      color: 'var(--accent-2)',
      subject: topMega.pokemon,
      stat: `${pct(topMega.usage_pct)} usage · ${pct(topMega.win_rate)} WR`,
      href: `/mega/${encodeURIComponent(topMega.pokemon)}`,
    });
  }

  const wrKing = [...megaRows].sort((a, b) => b.win_rate - a.win_rate)[0];
  if (wrKing) {
    out.push({
      category: 'Win Rate King',
      icon: 'bi-bar-chart-fill',
      color: 'var(--green)',
      subject: wrKing.pokemon,
      stat: `${pct(wrKing.win_rate)} WR · ${pct(wrKing.usage_pct)} usage`,
      href: `/mega/${encodeURIComponent(wrKing.pokemon)}`,
    });
  }

  const topPokemon = pokemonRows[0];
  if (topPokemon) {
    out.push({
      category: 'Most Used Pokémon',
      icon: 'bi-people-fill',
      color: 'var(--text-2)',
      subject: topPokemon.species,
      stat: `${pct(topPokemon.usage_pct)} usage · ${pct(topPokemon.win_rate)} WR`,
      href: `/pokemon/${encodeURIComponent(topPokemon.species)}`,
    });
  }

  const bestCombo = [...comboRows].sort((a, b) => b.win_rate - a.win_rate)[0];
  if (bestCombo) {
    out.push({
      category: 'Best Duo',
      icon: 'bi-link-45deg',
      color: 'var(--accent)',
      subject: bestCombo.combo,
      stat: `${pct(bestCombo.win_rate)} WR · ${pct(bestCombo.usage_pct)} of teams`,
      href: '/mega',
    });
  }

  const climber = [...megaRows].sort(
    (a, b) => (b.top_cut_usage - b.usage_pct) - (a.top_cut_usage - a.usage_pct)
  )[0];
  if (climber) {
    const delta = climber.top_cut_usage - climber.usage_pct;
    out.push({
      category: 'Top Cut Climber',
      icon: 'bi-arrow-up-circle-fill',
      color: 'var(--yellow)',
      subject: climber.pokemon,
      stat: `+${pct(delta)} top cut lift · ${pct(climber.top_cut_usage)} in top cut`,
      href: `/mega/${encodeURIComponent(climber.pokemon)}`,
    });
  }

  const dominant = [...h2hRows].sort((a, b) => b.mega1_wr - a.mega1_wr)[0];
  if (dominant) {
    out.push({
      category: 'Biggest Edge',
      icon: 'bi-lightning-fill',
      color: 'var(--red)',
      subject: dominant.mega1,
      stat: `${pct(dominant.mega1_wr)} WR vs ${dominant.mega2}`,
      href: '/mega',
    });
  }

  return out;
}

function InsightsGrid() {
  const [insights, setInsights] = useState<InsightDef[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_mega_usage', {}),
      supabase.rpc('get_pokemon_usage', {}),
      supabase.rpc('get_mega_combos', {}),
      supabase.rpc('get_mega_h2h', {}),
    ])
      .then(([mega, pokemon, combos, h2h]) => {
        if (mega.error)    throw new Error(mega.error.message);
        if (pokemon.error) throw new Error(pokemon.error.message);
        if (combos.error)  throw new Error(combos.error.message);
        if (h2h.error)     throw new Error(h2h.error.message);
        setInsights(computeInsights(
          (mega.data    ?? []) as MegaUsageRow[],
          (pokemon.data ?? []) as PokemonUsageRow[],
          (combos.data  ?? []) as MegaComboRow[],
          (h2h.data     ?? []) as MegaH2HRow[],
        ));
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="mg-section-error">{error}</p>;

  if (loading) {
    return (
      <div className="mg-insights-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="mg-insight-card mg-insight-card--skel" aria-hidden>
            <div className="skel" style={{ width: 90, height: 12, marginBottom: 16 }} />
            <div className="skel" style={{ width: '70%', height: 20, marginBottom: 8 }} />
            <div className="skel" style={{ width: '55%', height: 13 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mg-insights-grid">
      {insights.map(ins => (
        <Link key={ins.category} to={ins.href} className="mg-insight-card">
          <span className="mg-insight-card__cat" style={{ color: ins.color }}>
            <i className={`bi ${ins.icon}`} />
            {ins.category}
          </span>
          <span className="mg-insight-card__subject">{ins.subject}</span>
          <span className="mg-insight-card__stat">{ins.stat}</span>
        </Link>
      ))}
    </div>
  );
}

// ─── Recent Events ────────────────────────────────────────────────────────────

function recentDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RecentEvents() {
  const [rows, setRows]   = useState<TournamentRow[]>([]);
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
            <h2 className="mg-section__title">Meta Insights</h2>
          </div>
          <p className="mg-section__sub">Key stats and trends across all M-A tournaments</p>
          <InsightsGrid />
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
    </main>
  );
}
