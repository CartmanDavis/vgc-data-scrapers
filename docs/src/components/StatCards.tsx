import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import './StatCards.css';

interface Stats {
  tournaments: number;
  players: number;
  dateRange: string;
  format: string;
}

async function fetchStats(): Promise<Stats> {
  const [tournamentsResult, playersResult] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, date', { count: 'exact' })
      .eq('format', 'M-A'),
    supabase.rpc('get_metagame_summary'),
  ]);

  const tournaments = tournamentsResult.data ?? [];
  const count = tournamentsResult.count ?? tournaments.length;

  const dates = tournaments
    .map((t: { date: string }) => t.date)
    .filter(Boolean)
    .sort();

  let dateRange = 'N/A';
  if (dates.length >= 2) {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    dateRange = `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
  } else if (dates.length === 1) {
    dateRange = new Date(dates[0]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  const summary = Array.isArray(playersResult.data) ? playersResult.data[0] : null;
  const players: number = summary?.unique_players ?? 0;

  return { tournaments: count, players, dateRange, format: 'M-A (Mega)' };
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

  const cards: { label: string; value: string; icon: string }[] = stats
    ? [
        { label: 'Tournaments', value: String(stats.tournaments), icon: 'bi-trophy' },
        { label: 'Players',     value: stats.players > 0 ? stats.players.toLocaleString() : '—', icon: 'bi-people-fill' },
        { label: 'Date Range',  value: stats.dateRange,            icon: 'bi-calendar3' },
        { label: 'Format',      value: stats.format,               icon: 'bi-tag-fill' },
      ]
    : [];

  if (loading) {
    return (
      <div className="stat-cards" aria-label="Metagame summary">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="stat-card stat-card--skeleton" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="stat-cards" aria-label="Metagame summary">
      {cards.map(({ label, value, icon }) => (
        <div key={label} className="stat-card">
          <i className={`bi ${icon} stat-card__icon`} aria-hidden="true" />
          <span className="stat-card__value">{value}</span>
          <span className="stat-card__label">{label}</span>
        </div>
      ))}
    </div>
  );
}
