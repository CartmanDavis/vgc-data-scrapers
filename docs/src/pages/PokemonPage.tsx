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
  MOCK_POKEMON_SPREADS,
  MOCK_NATURE_TRENDS,
} from "../mock-data";
import type { TrendPoint, PokemonPlayerRow, SpreadRow } from "../mock-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { Dex } from "@pkmn/dex";
import type { ID, ModData } from "@pkmn/dex";
import { Generations } from "@pkmn/data";
import * as ChampionsMod from "@pkmn/mods/champions";
import "./ProfilePage.css";
import "./PokemonPage.css";
import { PokemonIcon } from "../components/PokemonIcon";
import { TeamIcons } from "../components/TeamIcons";

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

function applySort<T>(rows: T[], col: keyof T | null, dir: "asc" | "desc"): T[] {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const av = a[col] as number;
    const bv = b[col] as number;
    return dir === "desc" ? bv - av : av - bv;
  });
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      className={className}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={onClick}
    >
      {label}{" "}
      <i
        className={`bi ${active ? (dir === "desc" ? "bi-caret-down-fill" : "bi-caret-up-fill") : "bi-caret-down"}`}
        style={{ fontSize: 10, opacity: active ? 1 : 0.35 }}
      />
    </th>
  );
}

function toggleSort<T extends string>(
  col: T,
  sort: { col: T; dir: "asc" | "desc" } | null,
  setSort: (s: { col: T; dir: "asc" | "desc" } | null) => void,
) {
  if (sort?.col === col) {
    setSort({ col, dir: sort.dir === "desc" ? "asc" : "desc" });
  } else {
    setSort({ col, dir: "desc" });
  }
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
    spreads: (MOCK_POKEMON_SPREADS[species] ??
      MOCK_POKEMON_SPREADS.default) as SpreadRow[],
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
  return (
    <span className="wr-text" style={{ color: wrColor(value) }}>{pct(value)}</span>
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

type Tab = "overview" | "moves" | "items" | "partners" | "matchups" | "stats";

// ─── Stat distribution via @pkmn ─────────────────────────────────────────────

const _championsDex = Dex.mod("champions" as ID, ChampionsMod as unknown as ModData);
const _gens = new Generations(_championsDex, (d) => {
  if (!d.exists) return false;
  if ("isNonstandard" in d && d.isNonstandard) return false;
  return true;
});
const _gen9 = _gens.get(9);

type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_LABELS: Record<StatKey, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const STAT_COLORS: Record<StatKey, string> = {
  hp:  "var(--green)",
  atk: "#f87171",
  def: "#60a5fa",
  spa: "var(--accent)",
  spd: "#34d399",
  spe: "#f59e0b",
};

function spForStat(row: SpreadRow, stat: StatKey): number {
  return { hp: row.hp, atk: row.atk, def: row.def, spa: row.spa, spd: row.spd, spe: row.spe }[stat];
}

// M-A format stat formula (from champions mod statModify):
//   HP:    base + sp + 75
//   Other: base + sp + 20, then nature ±10%
function maCalcStat(
  stat: StatKey,
  base: number,
  sp: number,
  nature: ReturnType<typeof _gen9.natures.get> | undefined | null,
): number {
  if (stat === "hp") return base + sp + 75;
  let val = base + sp + 20;
  if (nature?.plus === stat) val = Math.trunc(Math.trunc(val * 110) / 100);
  else if (nature?.minus === stat) val = Math.trunc(Math.trunc(val * 90) / 100);
  return val;
}

// Full stat range for a given stat in effective mode (0 SP minus nature → 32 SP plus nature)
function effectiveStatDomain(species: string, stat: StatKey): [number, number] {
  const mon = _championsDex.species.get(species);
  if (!mon?.exists) return [0, 32];
  const base = mon.baseStats[stat];
  if (stat === "hp") return [base + 75, base + 107];
  const minVal = Math.trunc(Math.trunc((base + 20) * 90) / 100);
  const maxVal = Math.trunc(Math.trunc((base + 52) * 110) / 100);
  return [minVal, maxVal];
}

// Boundaries between neutral range and nature-only zones (null for HP since nature doesn't apply)
function effectiveStatNatureZones(species: string, stat: StatKey): {
  minusBound: number; neutralMin: number; neutralMax: number; plusBound: number;
} | null {
  if (stat === "hp") return null;
  const mon = _championsDex.species.get(species);
  if (!mon?.exists) return null;
  const base = mon.baseStats[stat];
  return {
    minusBound: Math.trunc(Math.trunc((base + 20) * 90) / 100),
    neutralMin: base + 20,
    neutralMax: base + 52,
    plusBound: Math.trunc(Math.trunc((base + 52) * 110) / 100),
  };
}

function buildStatDistribution(
  species: string,
  spreads: SpreadRow[],
  stat: StatKey,
  mode: "investment" | "effective",
): { value: number; usage: number }[] {
  const mon = _championsDex.species.get(species);
  const buckets = new Map<number, number>();

  for (const row of spreads) {
    const nature = mon?.exists ? _gen9.natures.get(row.nature) : null;
    const sp = spForStat(row, stat);
    const value = mode === "effective" && mon?.exists
      ? maCalcStat(stat, mon.baseStats[stat], sp, nature)
      : sp;
    buckets.set(value, (buckets.get(value) ?? 0) + row.usage_pct);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, usage]) => ({ value, usage }));
}

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
  const [spreads, setSpreads] = useState<SpreadRow[]>([]);
  const [natureTrends, setNatureTrends] = useState<Record<string, TrendPoint[]>>({});
  const [selectedMoves, setSelectedMoves] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [selectedMatchups, setSelectedMatchups] = useState<string[]>([]);

  type SortDir = "asc" | "desc";
  type SortState<T extends string> = { col: T; dir: SortDir } | null;
  const [moveSort, setMoveSort] = useState<SortState<"win_rate">>(null);
  const [itemSort, setItemSort] = useState<SortState<"win_rate">>(null);
  const [partnerSort, setPartnerSort] = useState<SortState<"usage_pct" | "win_rate">>(null);
  const [matchupSort, setMatchupSort] = useState<SortState<"win_rate" | "opp_usage">>(null);
  const [spreadSort, setSpreadSort] = useState<SortState<"usage_pct">>({ col: "usage_pct", dir: "desc" });
  const [statViewMode, setStatViewMode] = useState<"investment" | "effective">("investment");
  const [selectedStat, setSelectedStat] = useState<StatKey>("hp");

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
        setSpreads(d.spreads);
        setNatureTrends(MOCK_NATURE_TRENDS[decoded] ?? MOCK_NATURE_TRENDS.default ?? {});
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
        <PokemonIcon species={decoded} size="large" className="pokemon-art" />
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
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="profile-tabs">
        {(["overview", "moves", "items", "partners", "matchups", "stats"] as Tab[]).map(
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
                  <th className="col-win-rate">Win Rate</th>
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
                      <td className="col-win-rate" style={{ width: 180 }}>
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
                <table className="profile-table profile-table--pokemon-teams">
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
                          <TeamIcons team={r.teammates} pasteUrl="https://pokepast.es/6dbe083ec3d8afa2" />
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
            const sorted = applySort(moves, moveSort?.col ?? null, moveSort?.dir ?? "desc");
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
                      <SortTh
                        label="Win Rate"
                        active={moveSort?.col === "win_rate"}
                        dir={moveSort?.dir ?? "desc"}
                        onClick={() => toggleSort("win_rate", moveSort, setMoveSort)}
                        className="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((r) => {
                        const origIdx = moves.findIndex((m) => m.move_name === r.move_name);
                        return (
                        <tr
                          key={r.move_name}
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
                                ? SERIES_COLORS[origIdx % SERIES_COLORS.length]
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
                          <td className="profile-table__num">
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}

        {tab === "items" &&
          (() => {
            const sorted = applySort(items, itemSort?.col ?? null, itemSort?.dir ?? "desc");
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
                      <SortTh
                        label="Win Rate"
                        active={itemSort?.col === "win_rate"}
                        dir={itemSort?.dir ?? "desc"}
                        onClick={() => toggleSort("win_rate", itemSort, setItemSort)}
                        className="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((r) => {
                        const origIdx = items.findIndex((m) => m.item === r.item);
                        return (
                        <tr
                          key={r.item}
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
                                ? SERIES_COLORS[origIdx % SERIES_COLORS.length]
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
                          <td className="profile-table__num">
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}

        {tab === "partners" &&
          (() => {
            const sorted = applySort(partners, partnerSort?.col ?? null, partnerSort?.dir ?? "desc");
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
                      <SortTh
                        label="Usage"
                        active={partnerSort?.col === "usage_pct"}
                        dir={partnerSort?.dir ?? "desc"}
                        onClick={() => toggleSort("usage_pct", partnerSort, setPartnerSort)}
                        className="right"
                      />
                      <SortTh
                        label="Win Rate"
                        active={partnerSort?.col === "win_rate"}
                        dir={partnerSort?.dir ?? "desc"}
                        onClick={() => toggleSort("win_rate", partnerSort, setPartnerSort)}
                        className="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((r) => {
                        const origIdx = partners.findIndex((m) => m.partner_species === r.partner_species);
                        return (
                        <tr
                          key={r.partner_species}
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
                                ? SERIES_COLORS[origIdx % SERIES_COLORS.length]
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
                          <td className="profile-table__num">
                            {pct(r.usage_pct)}
                          </td>
                          <td className="profile-table__num">
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}

        {tab === "matchups" &&
          (() => {
            const usageMap = new Map(allUsage.map((u) => [u.species.toLowerCase(), u.usage_pct]));
            const enriched = matchups.map((r) => ({
              ...r,
              opp_usage: usageMap.get(r.opponent_species.toLowerCase()) ?? 0,
            }));
            const sorted = applySort(enriched, matchupSort?.col ?? null, matchupSort?.dir ?? "desc");
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
                      <SortTh
                        label="Usage"
                        active={matchupSort?.col === "opp_usage"}
                        dir={matchupSort?.dir ?? "desc"}
                        onClick={() => toggleSort("opp_usage", matchupSort, setMatchupSort)}
                        className="right"
                      />
                      <SortTh
                        label="Win Rate"
                        active={matchupSort?.col === "win_rate"}
                        dir={matchupSort?.dir ?? "desc"}
                        onClick={() => toggleSort("win_rate", matchupSort, setMatchupSort)}
                        className="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="profile-no-data">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((r) => {
                        const origIdx = matchups.findIndex((m) => m.opponent_species === r.opponent_species);
                        return (
                        <tr
                          key={r.opponent_species}
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
                                ? SERIES_COLORS[origIdx % SERIES_COLORS.length]
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
                          <td className="profile-table__num">{pct(r.opp_usage)}</td>
                          <td className="profile-table__num">
                            <WinRateBar value={r.win_rate} />
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}

        {tab === "stats" && (() => {
          const sorted = applySort(spreads, spreadSort?.col ?? null, spreadSort?.dir ?? "desc");


          return (
            <>
              <h3 className="profile-section-heading" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                Nature distribution
              </h3>
              <MultiTrendChart
                series={Object.entries(natureTrends).map(([name, points], i) => ({
                  name,
                  color: SERIES_COLORS[i % SERIES_COLORS.length],
                  points,
                }))}
                defaultMetric="usage"
                showToggle={false}
                height={220}
              />

              <h3 className="profile-section-heading">Stats</h3>

              {/* Distribution chart */}
              <div className="trend-chart" style={{ paddingTop: 0 }}>
                <div className="trend-chart__header stat-chart-header">
                  <div className="trend-chart__title">
                    <span className="trend-chart__name">Stats</span>
                    <span className="trend-chart__period">Jan – Apr 2026 · weekly</span>
                  </div>
                  <div className="trend-chart__right" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <div className="stat-btn-group">
                      {STAT_KEYS.map((stat) => {
                        const active = selectedStat === stat;
                        return (
                          <button
                            key={stat}
                            className="stat-btn"
                            onClick={() => setSelectedStat(stat)}
                            style={{
                              display: "flex", alignItems: "center",
                              borderRadius: 99,
                              border: `1px solid ${active ? STAT_COLORS[stat] : "var(--border)"}`,
                              background: active ? `${STAT_COLORS[stat]}22` : "transparent",
                              color: active ? STAT_COLORS[stat] : "var(--text-4)",
                              fontFamily: "var(--font-ui)", fontWeight: 600,
                              cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            {STAT_LABELS[stat]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="trend-chart__toggle">
                      <button
                        className={`trend-toggle-btn${statViewMode === "investment" ? " active" : ""}`}
                        onClick={() => setStatViewMode("investment")}
                      >
                        Investment
                      </button>
                      <button
                        className={`trend-toggle-btn${statViewMode === "effective" ? " active" : ""}`}
                        onClick={() => setStatViewMode("effective")}
                      >
                        Effective
                      </button>
                    </div>
                  </div>
                </div>
                {(() => {
                const distData = buildStatDistribution(decoded, spreads, selectedStat, statViewMode);
                const domain: [number, number] = statViewMode === "investment"
                  ? [0, 32]
                  : effectiveStatDomain(decoded, selectedStat);
                const ticks = statViewMode === "investment"
                  ? [0, 4, 8, 12, 16, 20, 24, 28, 32]
                  : undefined;
                const zones = statViewMode === "effective"
                  ? effectiveStatNatureZones(decoded, selectedStat)
                  : null;
                return (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={distData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="stat-minus-grad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="60%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="stat-plus-grad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0} />
                          <stop offset="40%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.35} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      {zones && <ReferenceArea x1={zones.minusBound} x2={zones.neutralMin} fill="url(#stat-minus-grad)" strokeOpacity={0} />}
                      {zones && <ReferenceArea x1={zones.neutralMax} x2={zones.plusBound} fill="url(#stat-plus-grad)" strokeOpacity={0} />}
                      <XAxis
                        dataKey="value"
                        type="number"
                        domain={domain}
                        ticks={ticks}
                        padding={{ left: 10, right: 10 }}
                        tick={{ fontSize: 11, fill: "var(--text-4)", fontFamily: "JetBrains Mono, monospace" }}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--text-4)", fontFamily: "JetBrains Mono, monospace" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                      />
                      <Tooltip
                        contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "var(--font-ui)" }}
                        formatter={(v: number) => [`${v.toFixed(1)}%`, STAT_LABELS[selectedStat]]}
                        labelFormatter={(v) => statViewMode === "investment" ? `${v} SP` : `Stat: ${v}`}
                        cursor={false}
                      />
                      <Bar
                        dataKey="usage"
                        fill={STAT_COLORS[selectedStat]}
                        maxBarSize={20}
                        radius={[2, 2, 0, 0]}
                        activeBar={{ fill: STAT_COLORS[selectedStat], stroke: "white", strokeWidth: 2, strokeOpacity: 0.5 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
              </div>

              <table className="profile-table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Stat Points</th>
                    <th className="right">Nature</th>
                    <SortTh
                      label="Usage"
                      active={spreadSort?.col === "usage_pct"}
                      dir={spreadSort?.dir ?? "desc"}
                      onClick={() => toggleSort("usage_pct", spreadSort, setSpreadSort)}
                      className="col-win-rate"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="profile-no-data">No data available.</td>
                    </tr>
                  ) : (
                    sorted.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                            {r.hp}/{r.atk}/{r.def}/{r.spa}/{r.spd}/{r.spe}
                          </td>
                          <td className="profile-table__num" style={{ color: "var(--text-2)" }}>{r.nature}</td>
                          <td className="col-win-rate" style={{ width: 180 }}>
                            <span style={{ color: "var(--accent)" }}>{pct(r.usage_pct)}</span>
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
