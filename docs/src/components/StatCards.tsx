import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import "./StatCards.css";

interface Stats {
  tournaments: number;
  players: number;
  dateRange: string;
  format: string;
}

async function fetchStats(): Promise<Stats> {
  const [tournamentsResult, playersResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, date", { count: "exact" })
      .eq("format", "M-A"),
    supabase.rpc("get_metagame_summary"),
  ]);

  const tournaments = tournamentsResult.data ?? [];
  const count = tournamentsResult.count ?? tournaments.length;

  const dates = tournaments
    .map((t: { date: string }) => t.date)
    .filter(Boolean)
    .sort();

  let dateRange = "N/A";
  if (dates.length >= 2) {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    dateRange = `${fmt(dates[0])}–${fmt(dates[dates.length - 1])}`;
  } else if (dates.length === 1) {
    dateRange = new Date(dates[0]).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  const summary = Array.isArray(playersResult.data)
    ? playersResult.data[0]
    : null;
  const players: number = summary?.unique_players ?? 0;

  return { tournaments: count, players, dateRange, format: "M-A (Mega)" };
}

interface CardDef {
  key: keyof Stats;
  label: string;
  meta: string;
}

const CARD_DEFS: CardDef[] = [
  { key: "format", label: "Format", meta: "active ruleset" },
  { key: "dateRange", label: "Date Range", meta: "data window" },
  { key: "tournaments", label: "Tournaments", meta: "events" },
  { key: "players", label: "Players", meta: "unique entrants" },
];

function formatValue(key: keyof Stats, stats: Stats): string {
  if (key === "players")
    return stats.players > 0 ? stats.players.toLocaleString() : "—";
  return String(stats[key]);
}

export function StatCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="stat-cards" aria-label="Metagame summary">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="stat-card stat-card--skeleton"
            aria-hidden="true"
          />
        ))}
      </section>
    );
  }

  if (!stats) return null;

  return (
    <section className="stat-cards" aria-label="Metagame summary">
      {CARD_DEFS.map(({ key, label, meta }) => (
        <div key={key} className="stat-card">
          <span className="stat-card__label">{label}</span>
          <span className="stat-card__value">{formatValue(key, stats)}</span>
          <span className="stat-card__meta">{meta}</span>
        </div>
      ))}
    </section>
  );
}
