import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { TrendChart } from "../components/TrendChart";
import { MultiTrendChart } from "../components/MultiTrendChart";
import {
  MOCK_POKEMON_USAGE,
  MOCK_POKEMON_MOVES,
  MOCK_POKEMON_ITEMS,
  MOCK_POKEMON_PARTNERS,
  MOCK_POKEMON_MATCHUPS,
  MOCK_POKEMON_TREND,
  MOCK_POKEMON_PLAYERS,
} from "../mock-data";
import type { TrendPoint, PokemonPlayerRow } from "../mock-data";
import "./ProfilePage.css";
import "./PokemonPage.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MoveRow {
  move_name: string;
  teams: number;
  win_rate: number;
  type?: string;
  category?: "physical" | "special" | "status";
  trend?: TrendPoint[];
}
interface ItemRow {
  item: string;
  teams: number;
  win_rate: number;
  trend?: TrendPoint[];
}
interface PartnerRow {
  partner_species: string;
  teams: number;
  usage_pct: number;
  win_rate: number;
  trend?: TrendPoint[];
}
interface MatchupRow {
  opponent_species: string;
  matches: number;
  wins: number;
  win_rate: number;
  trend?: TrendPoint[];
}
interface PokemonStats {
  usage_pct: number;
  win_rate: number;
  teams: number;
}
interface TeamRow {
  player_id: string;
  player_name: string;
  tournament_id: string;
  tournament_name: string;
  date: string;
  placing: number;
  wins: number;
  losses: number;
  teammates: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spriteUrl(species: string): string {
  const slug = species
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  return `https://img.pokemondb.net/sprites/scarlet-violet/normal/${slug}.png`;
}

function itemSpriteUrl(item: string): string {
  const slug = item
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  return `https://img.pokemondb.net/sprites/items/${slug}.png`;
}

function TypeBadge({ type }: { type: string }) {
  const slug = type.toLowerCase();
  return (
    <img
      src={`/types/${slug}.png`}
      alt={type}
      style={{ verticalAlign: "middle", height: 18, width: "auto" }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function CategoryIcon({
  category,
}: {
  category: "physical" | "special" | "status";
}) {
  return (
    <img
      src={`https://img.pokemondb.net/images/icons/move-${category}.png`}
      alt={category}
      style={{
        marginRight: 6,
        verticalAlign: "middle",
        height: 20,
        width: "auto",
      }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function pct(v: number | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function wrColor(v: number): string {
  if (v >= 55) return "var(--green)";
  if (v >= 50) return "var(--text-h)";
  return "var(--red)";
}

function fetchAll(species: string) {
  const allUsage = MOCK_POKEMON_USAGE;
  const stats =
    allUsage.find((r) => r.species.toLowerCase() === species.toLowerCase()) ??
    null;
  return Promise.resolve({
    stats,
    allUsage,
    moves: (MOCK_POKEMON_MOVES[species] ??
      MOCK_POKEMON_MOVES.default) as MoveRow[],
    items: (MOCK_POKEMON_ITEMS[species] ??
      MOCK_POKEMON_ITEMS.default) as ItemRow[],
    partners: (MOCK_POKEMON_PARTNERS[species] ??
      MOCK_POKEMON_PARTNERS.default) as PartnerRow[],
    matchups: (MOCK_POKEMON_MATCHUPS[species] ??
      MOCK_POKEMON_MATCHUPS.default) as MatchupRow[],
    trend: (MOCK_POKEMON_TREND[species] ??
      MOCK_POKEMON_TREND.default) as TrendPoint[],
    players: (MOCK_POKEMON_PLAYERS[species] ??
      MOCK_POKEMON_PLAYERS.default) as PokemonPlayerRow[],
  });
}

// ─── Insights ─────────────────────────────────────────────────────────────────

interface Insight {
  type: "positive" | "negative" | "neutral";
  icon: string;
  text: string;
}

type UsageRow = {
  species: string;
  usage_pct: number;
  win_rate: number;
  teams: number;
  unique_players?: number;
  top_cut_players?: number;
  top_cut_usage?: number;
  top_cut_wr?: number;
};

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function computeInsights(
  species: string,
  trend: TrendPoint[],
  matchups: MatchupRow[],
  allUsage: UsageRow[],
): Insight[] {
  const out: Insight[] = [];
  const self = allUsage.find(
    (u) => u.species.toLowerCase() === species.toLowerCase(),
  );

  // ── Meta rank ──────────────────────────────────────────────────────────────
  if (self && allUsage.length > 1) {
    const sorted = [...allUsage].sort((a, b) => b.usage_pct - a.usage_pct);
    const rank =
      sorted.findIndex(
        (u) => u.species.toLowerCase() === species.toLowerCase(),
      ) + 1;
    const total = sorted.length;
    const tier =
      rank <= 3
        ? "one of the most dominant threats in the format"
        : rank <= 8
          ? "a consistent meta staple"
          : rank <= Math.ceil(total * 0.33)
            ? "a solid mid-tier presence"
            : "a niche or fringe pick";
    out.push({
      type: rank <= 8 ? "positive" : "neutral",
      icon: "bi-bar-chart-fill",
      text: `Ranked #${rank} of ${total} by usage (${self.usage_pct.toFixed(1)}%) — ${tier}`,
    });
  }

  // ── Unique player depth ────────────────────────────────────────────────────
  if (self?.unique_players != null) {
    const u = self.unique_players;
    const teamsPerPlayer = self.teams / u;

    if (u < 20 && self.win_rate >= 53) {
      // Small cohort driving a strong win rate — flag as potentially skewed
      out.push({
        type: "neutral",
        icon: "bi-person-exclamation",
        text: `Only ${u} unique players used this — ${self.win_rate.toFixed(1)}% win rate may reflect a small pool of specialists rather than broad viability`,
      });
    } else if (teamsPerPlayer >= 2.5) {
      // A few players entering it into many tournaments
      out.push({
        type: "neutral",
        icon: "bi-person-lines-fill",
        text: `${u} unique players, averaging ${teamsPerPlayer.toFixed(1)} tournament entries each — a dedicated core driving its presence`,
      });
    } else if (self.top_cut_players != null) {
      const successRate = Math.round((self.top_cut_players / u) * 100);
      out.push({
        type: successRate >= 30 ? "positive" : "neutral",
        icon: "bi-people-fill",
        text: `${u.toLocaleString()} unique players — ${self.top_cut_players} (${successRate}%) reached top cut`,
      });
    }
  }

  // ── Lowkey threat ──────────────────────────────────────────────────────────
  if (self && self.usage_pct < 20 && self.win_rate >= 53) {
    out.push({
      type: "positive",
      icon: "bi-eye-slash-fill",
      text: `Lowkey threat — only ${self.usage_pct.toFixed(1)}% usage but ${self.win_rate.toFixed(1)}% win rate suggests it's flying under the radar`,
    });
  }

  // ── Skill split ────────────────────────────────────────────────────────────
  if (self && self.top_cut_wr != null && self.top_cut_usage != null) {
    const wrDiff = self.top_cut_wr - self.win_rate;
    const usageDiff = self.top_cut_usage - self.usage_pct;

    if (wrDiff >= 3) {
      out.push({
        type: "positive",
        icon: "bi-mortarboard-fill",
        text: `High skill ceiling — win rate climbs from ${self.win_rate.toFixed(1)}% overall to ${self.top_cut_wr.toFixed(1)}% among top-placing players (+${wrDiff.toFixed(1)}%)`,
      });
    } else if (wrDiff <= -3) {
      out.push({
        type: "negative",
        icon: "bi-mortarboard-fill",
        text: `Loses favor at high level — win rate drops from ${self.win_rate.toFixed(1)}% overall to ${self.top_cut_wr.toFixed(1)}% among top-placing players`,
      });
    } else {
      out.push({
        type: "neutral",
        icon: "bi-mortarboard-fill",
        text: `Consistent across skill levels — ${self.win_rate.toFixed(1)}% overall vs ${self.top_cut_wr.toFixed(1)}% among top-placing players`,
      });
    }

    if (usageDiff >= 5) {
      out.push({
        type: "positive",
        icon: "bi-stars",
        text: `High conversion to top cut — ${self.top_cut_usage.toFixed(1)}% usage among top-placing players vs ${self.usage_pct.toFixed(1)}% overall`,
      });
    } else if (usageDiff <= -5) {
      out.push({
        type: "negative",
        icon: "bi-stars",
        text: `Underrepresented in top cut — only ${self.top_cut_usage.toFixed(1)}% usage among top-placing players vs ${self.usage_pct.toFixed(1)}% overall`,
      });
    }
  }

  // ── Usage & win-rate trend ──────────────────────────────────────────────────
  if (trend.length >= 4) {
    const mid = Math.floor(trend.length / 2);
    const recentUsage = avg(trend.slice(mid).map((d) => d.usage_pct));
    const olderUsage = avg(trend.slice(0, mid).map((d) => d.usage_pct));
    const uDelta = recentUsage - olderUsage;

    if (uDelta >= 2) {
      out.push({
        type: "positive",
        icon: "bi-graph-up-arrow",
        text: `Trending up — usage has risen ${uDelta.toFixed(1)}% over the past month`,
      });
    } else if (uDelta <= -2) {
      out.push({
        type: "negative",
        icon: "bi-graph-down-arrow",
        text: `Falling off — usage has dropped ${Math.abs(uDelta).toFixed(1)}% over the past month`,
      });
    } else {
      out.push({
        type: "neutral",
        icon: "bi-activity",
        text: "Holding steady — usage is consistent over the past month",
      });
    }

    const recentWR = avg(trend.slice(mid).map((d) => d.win_rate));
    const olderWR = avg(trend.slice(0, mid).map((d) => d.win_rate));
    const wDelta = recentWR - olderWR;
    if (wDelta >= 2) {
      out.push({
        type: "positive",
        icon: "bi-shield-fill-check",
        text: `Win rate improving — up ${wDelta.toFixed(1)}% in recent weeks`,
      });
    } else if (wDelta <= -2) {
      out.push({
        type: "negative",
        icon: "bi-shield-fill-x",
        text: `Win rate declining — down ${Math.abs(wDelta).toFixed(1)}% in recent weeks`,
      });
    }
  }

  // ── Matchup meta-relevance ──────────────────────────────────────────────────
  const usageMap = new Map(
    allUsage.map((u) => [u.species.toLowerCase(), u.usage_pct]),
  );
  const POPULAR = 15; // usage % threshold to be considered "meta-relevant"

  const withMeta = matchups
    .map((m) => ({
      ...m,
      metaUsage: usageMap.get(m.opponent_species.toLowerCase()) ?? 0,
    }))
    .filter((m) => m.metaUsage >= POPULAR);

  const goodVs = withMeta
    .filter((m) => m.win_rate >= 55)
    .sort((a, b) => b.win_rate - a.win_rate)
    .slice(0, 2);
  const badVs = withMeta
    .filter((m) => m.win_rate <= 45)
    .sort((a, b) => a.win_rate - b.win_rate)
    .slice(0, 2);

  for (const m of goodVs) {
    out.push({
      type: "positive",
      icon: "bi-lightning-fill",
      text: `Favorable vs ${m.opponent_species} — ${m.win_rate.toFixed(1)}% win rate (${m.metaUsage.toFixed(1)}% meta usage)`,
    });
  }
  for (const m of badVs) {
    out.push({
      type: "negative",
      icon: "bi-exclamation-triangle-fill",
      text: `Struggles vs ${m.opponent_species} — ${m.win_rate.toFixed(1)}% win rate (${m.metaUsage.toFixed(1)}% meta usage)`,
    });
  }

  return out;
}

function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;
  return (
    <div className="insights-panel">
      <p className="insights-panel__label">Meta Insights</p>
      <div className="insights-list">
        {insights.map((ins, i) => (
          <div key={i} className={`insight-item insight-item--${ins.type}`}>
            <i className={`bi ${ins.icon} insight-item__icon`} aria-hidden />
            <span className="insight-item__text">{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinRateBar({ value }: { value: number }) {
  const color = wrColor(value);
  return (
    <div className="wr-bar" aria-label={`${pct(value)} win rate`}>
      <div
        className="wr-bar__fill"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: color,
        }}
      />
      <span className="wr-bar__label" style={{ color }}>
        {pct(value)}
      </span>
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
              <td>
                <div
                  className="skel"
                  style={{ width: `${45 + ((i * 13) % 35)}%`, height: 14 }}
                />
              </td>
              <td>
                <div
                  className="skel"
                  style={{ width: 36, height: 14, marginLeft: "auto" }}
                />
              </td>
              {cols >= 3 && (
                <td>
                  <div className="skel" style={{ height: 22 }} />
                </td>
              )}
              {cols >= 4 && (
                <td>
                  <div
                    className="skel"
                    style={{ width: 46, height: 14, marginLeft: "auto" }}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type Tab = "overview" | "moves" | "items" | "partners" | "matchups";

// ─── Mock teams data ──────────────────────────────────────────────────────────

function mockTeams(species: string): TeamRow[] {
  const pool = [
    ["Garchomp", "Incineroar", "Tornadus", "Landorus-Therian", "Rillaboom"],
    ["Urshifu", "Regieleki", "Landorus-Therian", "Incineroar", "Grimmsnarl"],
    ["Flutter Mane", "Iron Hands", "Palafin", "Tornadus", "Incineroar"],
    ["Chien-Pao", "Amoonguss", "Urshifu", "Incineroar", "Rillaboom"],
    ["Iron Bundle", "Annihilape", "Landorus-Therian", "Tornadus", "Incineroar"],
    ["Calyrex-Shadow", "Zacian", "Incineroar", "Rillaboom", "Grimmsnarl"],
  ];
  const tournaments = [
    {
      id: "t1",
      name: "Toronto Regional Championship 2026",
      date: "2026-04-12",
    },
    {
      id: "t2",
      name: "Charlotte Regional Championship 2026",
      date: "2026-03-22",
    },
    {
      id: "t3",
      name: "Stuttgart Regional Championship 2026",
      date: "2026-03-08",
    },
    {
      id: "t4",
      name: "San Diego Regional Championship 2026",
      date: "2026-02-15",
    },
    { id: "t5", name: "Bochum Regional Championship 2026", date: "2026-01-25" },
    {
      id: "t6",
      name: "Liverpool Regional Championship 2026",
      date: "2026-01-11",
    },
    {
      id: "t7",
      name: "Vancouver Regional Championship 2026",
      date: "2025-12-07",
    },
    { id: "t8", name: "Sydney Regional Championship 2025", date: "2025-11-23" },
  ];
  const players = [
    { id: "p1", name: "Wolfe Glick" },
    { id: "p2", name: "Sejun Park" },
    { id: "p3", name: "Aaron Traylor" },
    { id: "p4", name: "Eduardo Cunha" },
    { id: "p5", name: "Nico Davide Cognetta" },
    { id: "p6", name: "Raghav Malaviya" },
    { id: "p7", name: "James Baek" },
    { id: "p8", name: "Ashton Cox" },
    { id: "p9", name: "Justin Burns" },
    { id: "p10", name: "Sam Pandelis" },
  ];
  const placings = [1, 4, 2, 8, 16, 6, 3, 12, 7, 5];
  const records = [
    [8, 1],
    [7, 2],
    [6, 2],
    [6, 3],
    [5, 3],
    [7, 1],
    [8, 0],
    [5, 4],
    [6, 2],
    [7, 2],
  ];
  return Array.from({ length: 10 }, (_, i) => {
    const t = tournaments[i % tournaments.length];
    const p = players[i % players.length];
    const mates = pool[i % pool.length].slice(0, 5);
    return {
      player_id: p.id,
      player_name: p.name,
      tournament_id: t.id,
      tournament_name: t.name,
      date: t.date,
      placing: placings[i],
      wins: records[i][0],
      losses: records[i][1],
      teammates: [species, ...mates],
    };
  });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function placingLabel(p: number): string {
  if (p === 1) return "1st";
  if (p === 2) return "2nd";
  if (p === 3) return "3rd";
  return `${p}th`;
}

// ─── Series color palette ─────────────────────────────────────────────────────

const SERIES_COLORS = [
  "var(--accent)",
  "var(--green)",
  "#f59e0b",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#60a5fa",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PokemonPage() {
  const { species } = useParams<{ species: string }>();
  const decoded = species ? decodeURIComponent(species) : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PokemonStats | null>(null);
  const [allUsage, setAllUsage] = useState<UsageRow[]>([]);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [matchups, setMatchups] = useState<MatchupRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [players, setPlayers] = useState<PokemonPlayerRow[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedMoves, setSelectedMoves] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [selectedMatchups, setSelectedMatchups] = useState<string[]>([]);

  useEffect(() => {
    if (!decoded) return;
    setLoading(true);
    setError(null);
    fetchAll(decoded)
      .then((d) => {
        setStats(d.stats);
        setAllUsage(d.allUsage);
        setMoves(d.moves);
        setItems(d.items);
        setPartners(d.partners);
        setMatchups(d.matchups);
        setTrend(d.trend);
        setPlayers(d.players);
        setSelectedMoves(d.moves.slice(0, 5).map((r) => r.move_name));
        setSelectedItems(d.items.slice(0, 5).map((r) => r.item));
        setSelectedPartners(
          d.partners.slice(0, 5).map((r) => r.partner_species),
        );
        setSelectedMatchups(
          d.matchups.slice(0, 5).map((r) => r.opponent_species),
        );
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [decoded]);

  function toggleSelection(
    key: string,
    selected: string[],
    setSelected: (v: string[]) => void,
  ) {
    if (selected.includes(key)) {
      if (selected.length > 1) setSelected(selected.filter((k) => k !== key));
    } else {
      setSelected([...selected, key]);
    }
  }

  if (!decoded) {
    return (
      <div className="profile-page">
        <div className="profile-empty">No Pokemon selected.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-hero">
          <div className="profile-hero__content">
            <div className="skel skel--back" />
            <div className="skel skel--name" />
            <div className="profile-stats">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skel skel--stat" />
              ))}
            </div>
          </div>
        </div>
        <div className="profile-tabs">
          {[
            "Overview",
            "Moves",
            "Items",
            "Partners",
            "Matchups",
            "Players",
            "Teams",
          ].map((t) => (
            <button key={t} className="profile-tab" disabled>
              {t}
            </button>
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
            <Link to="/pokemon" className="back-link">
              <i className="bi bi-arrow-left" /> All Pokemon
            </Link>
            <h2 className="profile-name" style={{ color: "var(--red)" }}>
              Failed to load
            </h2>
            <p
              style={{
                color: "var(--text-3)",
                fontSize: 13,
                fontFamily: "var(--font-ui)",
                marginTop: 8,
              }}
            >
              {error}
            </p>
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
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="profile-hero__content">
          <Link to="/pokemon" className="back-link">
            <i className="bi bi-arrow-left" /> All Pokemon
          </Link>
          <h2 className="profile-name">{decoded}</h2>
          {stats && (
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat__value">
                  {pct(stats.usage_pct)}
                </span>
                <span className="profile-stat__label">Usage</span>
              </div>
              <div className="profile-stat">
                <span
                  className="profile-stat__value"
                  style={{ color: wrColor(stats.win_rate) }}
                >
                  {pct(stats.win_rate)}
                </span>
                <span className="profile-stat__label">Win Rate</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat__value">
                  {stats.teams.toLocaleString()}
                </span>
                <span className="profile-stat__label">Teams</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="profile-tabs">
        {(["overview", "moves", "items", "partners", "matchups"] as Tab[]).map(
          (t) => (
            <button
              key={t}
              className={`profile-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ),
        )}
      </div>

      {/* ── Content ── */}
      <div className="profile-body">
        {tab === "overview" && (
          <>
            <h3
              className="profile-section-heading"
              style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}
            >
              Usage trend
            </h3>
            {trend.length > 0 ? (
              <TrendChart
                data={trend}
                defaultMetric="both"
                height={280}
                showToggle={false}
              />
            ) : (
              <p className="profile-no-data" style={{ padding: "32px 0" }}>
                No trend data available.
              </p>
            )}

            <InsightsPanel
              insights={computeInsights(decoded, trend, matchups, allUsage)}
            />

            <h3
              className="profile-section-heading"
              style={{ borderTop: "none", paddingTop: 0 }}
            >
              Players
            </h3>
            <table className="profile-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="right">Entries</th>
                  <th className="right">Best</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="profile-no-data">
                      No data available.
                    </td>
                  </tr>
                ) : (
                  players.map((r, i) => (
                    <tr key={i}>
                      <td className="profile-table__name">
                        <Link
                          to={`/players/${r.player_id}`}
                          className="cell-link"
                        >
                          <span style={{ marginRight: 6 }}>{r.flag}</span>
                          {r.player_name}
                        </Link>
                      </td>
                      <td className="profile-table__num">{r.teams}</td>
                      <td className="profile-table__num">
                        <span
                          style={{
                            color:
                              r.best_placing <= 3
                                ? "var(--accent-2)"
                                : "var(--text-2)",
                          }}
                        >
                          {placingLabel(r.best_placing)}
                        </span>
                      </td>
                      <td style={{ width: 180 }}>
                        <WinRateBar value={r.win_rate} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <h3 className="profile-section-heading">Teams</h3>
            {(() => {
              const rows = mockTeams(decoded);
              return (
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Tournament</th>
                      <th>Player</th>
                      <th className="right">Place</th>
                      <th className="right">Record</th>
                      <th>Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-data)",
                              fontSize: 12,
                              color: "var(--text-4)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatDate(r.date)}
                          </span>
                        </td>
                        <td className="profile-table__name">
                          <Link
                            to={`/tournaments/${r.tournament_id}`}
                            className="cell-link"
                          >
                            {r.tournament_name}
                          </Link>
                        </td>
                        <td className="profile-table__name">
                          <Link
                            to={`/players/${r.player_id}`}
                            className="cell-link"
                          >
                            {r.player_name}
                          </Link>
                        </td>
                        <td className="profile-table__num">
                          <span
                            style={{
                              color:
                                r.placing <= 3
                                  ? "var(--accent-2)"
                                  : "var(--text-2)",
                            }}
                          >
                            {placingLabel(r.placing)}
                          </span>
                        </td>
                        <td className="profile-table__num">
                          <span style={{ color: "var(--green)" }}>
                            {r.wins}
                          </span>
                          <span
                            style={{ color: "var(--text-4)", margin: "0 2px" }}
                          >
                            –
                          </span>
                          <span style={{ color: "var(--red)" }}>
                            {r.losses}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontFamily: "var(--font-data)",
                              fontSize: 12,
                              color: "var(--text-3)",
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {r.teammates.join(", ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </>
        )}

        {tab === "moves" &&
          (() => {
            const series = moves
              .filter((r) => selectedMoves.includes(r.move_name))
              .map((r) => ({
                name: r.move_name,
                color:
                  SERIES_COLORS[
                    moves.findIndex((m) => m.move_name === r.move_name) %
                      SERIES_COLORS.length
                  ],
                points: r.trend ?? trend,
              }));
            return (
              <>
                {series.length > 0 && (
                  <MultiTrendChart
                    series={series}
                    defaultMetric="usage"
                    height={200}
                  />
                )}
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Move</th>
                      <th>Type</th>
                      <th>Cat.</th>
                      <th className="right">Teams</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moves.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      moves.map((r, i) => (
                        <tr
                          key={i}
                          className={
                            selectedMoves.includes(r.move_name)
                              ? "profile-table__row--selected"
                              : ""
                          }
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            toggleSelection(
                              r.move_name,
                              selectedMoves,
                              setSelectedMoves,
                            )
                          }
                        >
                          <td
                            className="profile-table__name"
                            style={{
                              color: selectedMoves.includes(r.move_name)
                                ? SERIES_COLORS[i % SERIES_COLORS.length]
                                : undefined,
                            }}
                          >
                            {r.move_name}
                          </td>
                          <td>{r.type && <TypeBadge type={r.type} />}</td>
                          <td>
                            {r.category && (
                              <CategoryIcon category={r.category} />
                            )}
                          </td>
                          <td className="profile-table__num">{r.teams}</td>
                          <td style={{ width: 180 }}>
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}

        {tab === "items" &&
          (() => {
            const series = items
              .filter((r) => selectedItems.includes(r.item))
              .map((r) => ({
                name: r.item,
                color:
                  SERIES_COLORS[
                    items.findIndex((m) => m.item === r.item) %
                      SERIES_COLORS.length
                  ],
                points: r.trend ?? trend,
              }));
            return (
              <>
                {series.length > 0 && (
                  <MultiTrendChart
                    series={series}
                    defaultMetric="usage"
                    height={200}
                  />
                )}
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="right">Teams</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      items.map((r, i) => (
                        <tr
                          key={i}
                          className={
                            selectedItems.includes(r.item)
                              ? "profile-table__row--selected"
                              : ""
                          }
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            toggleSelection(
                              r.item,
                              selectedItems,
                              setSelectedItems,
                            )
                          }
                        >
                          <td
                            className="profile-table__name"
                            style={{
                              color: selectedItems.includes(r.item)
                                ? SERIES_COLORS[i % SERIES_COLORS.length]
                                : undefined,
                            }}
                          >
                            <img
                              src={itemSpriteUrl(r.item)}
                              alt=""
                              aria-hidden
                              width={24}
                              height={24}
                              style={{
                                marginRight: 6,
                                verticalAlign: "middle",
                                imageRendering: "pixelated",
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                            {r.item}
                          </td>
                          <td className="profile-table__num">{r.teams}</td>
                          <td style={{ width: 180 }}>
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}

        {tab === "partners" &&
          (() => {
            const series = partners
              .filter((r) => selectedPartners.includes(r.partner_species))
              .map((r) => ({
                name: r.partner_species,
                color:
                  SERIES_COLORS[
                    partners.findIndex(
                      (m) => m.partner_species === r.partner_species,
                    ) % SERIES_COLORS.length
                  ],
                points: r.trend ?? trend,
              }));
            return (
              <>
                {series.length > 0 && (
                  <MultiTrendChart
                    series={series}
                    defaultMetric="usage"
                    height={200}
                  />
                )}
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Pokémon</th>
                      <th className="right">Teams</th>
                      <th className="right">Usage</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      partners.map((r, i) => (
                        <tr
                          key={i}
                          className={
                            selectedPartners.includes(r.partner_species)
                              ? "profile-table__row--selected"
                              : ""
                          }
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            toggleSelection(
                              r.partner_species,
                              selectedPartners,
                              setSelectedPartners,
                            )
                          }
                        >
                          <td
                            className="profile-table__name"
                            style={{
                              color: selectedPartners.includes(
                                r.partner_species,
                              )
                                ? SERIES_COLORS[i % SERIES_COLORS.length]
                                : undefined,
                            }}
                          >
                            <Link
                              to={`/pokemon/${encodeURIComponent(r.partner_species)}`}
                              className="cell-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.partner_species}
                            </Link>
                          </td>
                          <td className="profile-table__num">{r.teams}</td>
                          <td className="profile-table__num">
                            {pct(r.usage_pct)}
                          </td>
                          <td style={{ width: 180 }}>
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}

        {tab === "matchups" &&
          (() => {
            const series = matchups
              .filter((r) => selectedMatchups.includes(r.opponent_species))
              .map((r) => ({
                name: r.opponent_species,
                color:
                  SERIES_COLORS[
                    matchups.findIndex(
                      (m) => m.opponent_species === r.opponent_species,
                    ) % SERIES_COLORS.length
                  ],
                points: r.trend ?? trend,
              }));
            return (
              <>
                {series.length > 0 && (
                  <MultiTrendChart
                    series={series}
                    defaultMetric="winrate"
                    height={200}
                  />
                )}
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Opponent</th>
                      <th className="right">Matches</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchups.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      matchups.map((r, i) => (
                        <tr
                          key={i}
                          className={
                            selectedMatchups.includes(r.opponent_species)
                              ? "profile-table__row--selected"
                              : ""
                          }
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            toggleSelection(
                              r.opponent_species,
                              selectedMatchups,
                              setSelectedMatchups,
                            )
                          }
                        >
                          <td
                            className="profile-table__name"
                            style={{
                              color: selectedMatchups.includes(
                                r.opponent_species,
                              )
                                ? SERIES_COLORS[i % SERIES_COLORS.length]
                                : undefined,
                            }}
                          >
                            <Link
                              to={`/pokemon/${encodeURIComponent(r.opponent_species)}`}
                              className="cell-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.opponent_species}
                            </Link>
                          </td>
                          <td className="profile-table__num">{r.matches}</td>
                          <td style={{ width: 180 }}>
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}
      </div>
    </div>
  );
}
