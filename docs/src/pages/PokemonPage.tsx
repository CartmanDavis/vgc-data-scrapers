import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { TrendChart } from "../components/TrendChart";
import type { TrendPoint } from "../mock-data";
import "./ProfilePage.css";
import "./PokemonPage.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MoveRow    { move_name: string; teams: number; win_rate: number }
interface ItemRow    { item: string;      teams: number; win_rate: number }
interface PartnerRow { partner_species: string; teams: number; usage_pct: number; win_rate: number }
interface MatchupRow { opponent_species: string; matches: number; wins: number; win_rate: number }
interface PokemonStats { usage_pct: number; win_rate: number; teams: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spriteUrl(species: string): string {
  const slug = species.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  return `https://img.pokemondb.net/sprites/sword-shield/normal/${slug}.png`;
}

function pct(v: number | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function wrColor(v: number): string {
  if (v >= 55) return "var(--green)";
  if (v >= 50) return "var(--accent-2)";
  return "var(--red)";
}

async function fetchAll(species: string) {
  const p = { p_species: species };
  const [usageRes, movesRes, itemsRes, partnersRes, matchupsRes, trendRes] =
    await Promise.all([
      supabase.rpc("get_pokemon_usage", {}),
      supabase.rpc("get_pokemon_moves",    { ...p, p_mode: "all" }),
      supabase.rpc("get_pokemon_items",    { ...p, p_mode: "all" }),
      supabase.rpc("get_pokemon_partners", { ...p, p_mode: "all" }),
      supabase.rpc("get_pokemon_matchups", { ...p, p_mode: "all" }),
      supabase.rpc("get_pokemon_trend",    p),
    ]);
  const firstError = [usageRes, movesRes, itemsRes, partnersRes, matchupsRes, trendRes]
    .find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);
  const allUsage = (usageRes.data ?? []) as { species: string; usage_pct: number; win_rate: number; teams: number }[];
  return {
    stats:    allUsage.find((r) => r.species.toLowerCase() === species.toLowerCase()) ?? null,
    moves:    (movesRes.data    ?? []) as MoveRow[],
    items:    (itemsRes.data    ?? []) as ItemRow[],
    partners: (partnersRes.data ?? []) as PartnerRow[],
    matchups: (matchupsRes.data ?? []) as MatchupRow[],
    trend:    (trendRes.data    ?? []) as TrendPoint[],
  };
}

function WinRateBar({ value }: { value: number }) {
  const color = wrColor(value);
  return (
    <div className="wr-bar" aria-label={`${pct(value)} win rate`}>
      <div className="wr-bar__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      <span className="wr-bar__label" style={{ color }}>{pct(value)}</span>
    </div>
  );
}

// Skeleton for a single section (heading + chart + table rows)
function SectionSkeleton({ cols = 3 }: { cols?: number }) {
  return (
    <section className="pokemon-section" aria-hidden>
      <div className="skel pokemon-section__title-skel" />
      <div className="skel pokemon-section__chart-skel" />
      <table className="profile-table">
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i} className="profile-skel-row">
              <td><div className="skel" style={{ width: `${45 + (i * 13) % 35}%`, height: 14 }} /></td>
              <td><div className="skel" style={{ width: 36, height: 14, marginLeft: "auto" }} /></td>
              {cols >= 3 && <td><div className="skel" style={{ height: 22 }} /></td>}
              {cols >= 4 && <td><div className="skel" style={{ width: 46, height: 14, marginLeft: "auto" }} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type Tab = "overview" | "moves" | "items" | "partners" | "matchups";

// ─── Component ────────────────────────────────────────────────────────────────

export function PokemonPage() {
  const { species } = useParams<{ species: string }>();
  const decoded = species ? decodeURIComponent(species) : "";

  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [stats,    setStats]    = useState<PokemonStats | null>(null);
  const [moves,    setMoves]    = useState<MoveRow[]>([]);
  const [items,    setItems]    = useState<ItemRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [matchups, setMatchups] = useState<MatchupRow[]>([]);
  const [trend,    setTrend]    = useState<TrendPoint[]>([]);
  const [tab,      setTab]      = useState<Tab>("overview");

  useEffect(() => {
    if (!decoded) return;
    setLoading(true);
    setError(null);
    fetchAll(decoded)
      .then((d) => {
        setStats(d.stats);
        setMoves(d.moves);
        setItems(d.items);
        setPartners(d.partners);
        setMatchups(d.matchups);
        setTrend(d.trend);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [decoded]);

  if (!decoded) {
    return <div className="profile-page"><div className="profile-empty">No Pokemon selected.</div></div>;
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-hero">
          <div className="profile-hero__content">
            <div className="skel skel--back" />
            <div className="skel skel--name" />
            <div className="profile-stats">
              {[0, 1, 2].map((i) => <div key={i} className="skel skel--stat" />)}
            </div>
          </div>
        </div>
        <div className="profile-tabs">
          {["Overview", "Moves", "Items", "Partners", "Matchups"].map((t) => (
            <button key={t} className="profile-tab" disabled>{t}</button>
          ))}
        </div>
        <div className="profile-body">
          <SectionSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-hero">
          <div className="profile-hero__content">
            <Link to="/pokemon" className="back-link"><i className="bi bi-arrow-left" /> All Pokemon</Link>
            <h2 className="profile-name" style={{ color: "var(--red)" }}>Failed to load</h2>
            <p style={{ color: "var(--text-3)", fontSize: 13, fontFamily: "var(--font-ui)", marginTop: 8 }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">

      {/* ── Hero ── */}
      <div className="profile-hero">
        <div className="pokemon-art-glow" />
        <img
          src={spriteUrl(decoded)}
          alt={decoded}
          className="pokemon-art"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="profile-hero__content">
          <Link to="/pokemon" className="back-link"><i className="bi bi-arrow-left" /> All Pokemon</Link>
          <h2 className="profile-name">{decoded}</h2>
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
        {(["overview", "moves", "items", "partners", "matchups"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`profile-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="profile-body">

        {tab === "overview" && (
          trend.length > 0
            ? <TrendChart data={trend} name={decoded} defaultMetric="both" height={320} />
            : <p className="profile-no-data" style={{ padding: "32px 0" }}>No trend data available.</p>
        )}

        {tab === "moves" && (
          <>
            {trend.length > 0 && <TrendChart data={trend} defaultMetric="both" height={200} />}
            <table className="profile-table">
              <thead><tr>
                <th>Move</th>
                <th className="right">Teams</th>
                <th>Win Rate</th>
              </tr></thead>
              <tbody>
                {moves.length === 0
                  ? <tr><td colSpan={3} className="profile-no-data">No data available.</td></tr>
                  : moves.map((r, i) => (
                    <tr key={i}>
                      <td className="profile-table__name">{r.move_name}</td>
                      <td className="profile-table__num">{r.teams}</td>
                      <td style={{ width: 180 }}><WinRateBar value={r.win_rate} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "items" && (
          <>
            {trend.length > 0 && <TrendChart data={trend} defaultMetric="both" height={200} />}
            <table className="profile-table">
              <thead><tr>
                <th>Item</th>
                <th className="right">Teams</th>
                <th>Win Rate</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={3} className="profile-no-data">No data available.</td></tr>
                  : items.map((r, i) => (
                    <tr key={i}>
                      <td className="profile-table__name">{r.item}</td>
                      <td className="profile-table__num">{r.teams}</td>
                      <td style={{ width: 180 }}><WinRateBar value={r.win_rate} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "partners" && (
          <>
            {trend.length > 0 && <TrendChart data={trend} defaultMetric="both" height={200} />}
            <table className="profile-table">
              <thead><tr>
                <th>Pokémon</th>
                <th className="right">Teams</th>
                <th className="right">Usage</th>
                <th>Win Rate</th>
              </tr></thead>
              <tbody>
                {partners.length === 0
                  ? <tr><td colSpan={4} className="profile-no-data">No data available.</td></tr>
                  : partners.map((r, i) => (
                    <tr key={i}>
                      <td className="profile-table__name">
                        <Link to={`/pokemon/${encodeURIComponent(r.partner_species)}`} className="cell-link">
                          {r.partner_species}
                        </Link>
                      </td>
                      <td className="profile-table__num">{r.teams}</td>
                      <td className="profile-table__num">{pct(r.usage_pct)}</td>
                      <td style={{ width: 180 }}><WinRateBar value={r.win_rate} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "matchups" && (
          <>
            {trend.length > 0 && <TrendChart data={trend} defaultMetric="both" height={200} />}
            <table className="profile-table">
              <thead><tr>
                <th>Opponent</th>
                <th className="right">Matches</th>
                <th>Win Rate</th>
              </tr></thead>
              <tbody>
                {matchups.length === 0
                  ? <tr><td colSpan={3} className="profile-no-data">No data available.</td></tr>
                  : matchups.map((r, i) => (
                    <tr key={i}>
                      <td className="profile-table__name">
                        <Link to={`/pokemon/${encodeURIComponent(r.opponent_species)}`} className="cell-link">
                          {r.opponent_species}
                        </Link>
                      </td>
                      <td className="profile-table__num">{r.matches}</td>
                      <td style={{ width: 180 }}><WinRateBar value={r.win_rate} /></td>
                    </tr>
                  ))}
            </tbody>
            </table>
          </>
        )}

      </div>
    </div>
  );
}
