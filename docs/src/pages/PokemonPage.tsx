import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UsageChart } from '../components/UsageChart';
import './ProfilePage.css';
import './PokemonPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MoveRow     { move_name: string; teams: number; win_rate: number }
interface ItemRow     { item: string;      teams: number; win_rate: number }
interface PartnerRow  { partner_species: string; teams: number; usage_pct: number; win_rate: number }
interface MatchupRow  { opponent_species: string; matches: number; wins: number; win_rate: number }

interface PokemonStats {
  usage_pct: number;
  win_rate:  number;
  teams:     number;
}

type SectionTab = 'moves' | 'items' | 'partners' | 'matchups';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spriteUrl(species: string): string {
  const slug = species.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  return `https://img.pokemondb.net/sprites/sword-shield/normal/${slug}.png`;
}

function pct(v: number | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

async function fetchPokemonData(species: string, since: string | null) {
  const p = since ? { p_since: since, p_species: species } : { p_species: species };

  const [usageRes, movesRes, itemsRes, partnersRes, matchupsRes] = await Promise.all([
    supabase.rpc('get_pokemon_usage', since ? { p_since: since } : {}),
    supabase.rpc('get_pokemon_moves',    { ...p, p_mode: 'all' }),
    supabase.rpc('get_pokemon_items',    { ...p, p_mode: 'all' }),
    supabase.rpc('get_pokemon_partners', { ...p, p_mode: 'all' }),
    supabase.rpc('get_pokemon_matchups', { ...p, p_mode: 'all' }),
  ]);

  const allUsage = (usageRes.data ?? []) as { species: string; usage_pct: number; win_rate: number; teams: number }[];
  const stats = allUsage.find(r => r.species.toLowerCase() === species.toLowerCase()) ?? null;

  return {
    stats,
    moves:    (movesRes.data    ?? []) as MoveRow[],
    items:    (itemsRes.data    ?? []) as ItemRow[],
    partners: (partnersRes.data ?? []) as PartnerRow[],
    matchups: (matchupsRes.data ?? []) as MatchupRow[],
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-badge">
      <span className="stat-badge__value">{value}</span>
      <span className="stat-badge__label">{label}</span>
    </div>
  );
}

function DataSection<T>({
  title,
  data,
  renderRow,
  emptyMsg = 'No data available.',
}: {
  title: string;
  data: T[];
  renderRow: (row: T, idx: number) => React.ReactNode;
  emptyMsg?: string;
}) {
  return (
    <section className="pokemon-section">
      <h3 className="pokemon-section__title">{title}</h3>
      {data.length === 0 ? (
        <p className="pokemon-section__empty">{emptyMsg}</p>
      ) : (
        <table className="pokemon-table">
          <tbody>{data.map((row, i) => renderRow(row, i))}</tbody>
        </table>
      )}
    </section>
  );
}

function WinRateBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 55 ? '#4ade80' : clamped >= 50 ? '#c084fc' : '#f87171';
  return (
    <div className="wr-bar" aria-label={`${pct(value)} win rate`}>
      <div className="wr-bar__fill" style={{ width: `${clamped}%`, background: color }} />
      <span className="wr-bar__label">{pct(value)}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PokemonPage() {
  const { species } = useParams<{ species: string }>();
  const decoded = species ? decodeURIComponent(species) : '';

  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [stats,   setStats]     = useState<PokemonStats | null>(null);
  const [moves,   setMoves]     = useState<MoveRow[]>([]);
  const [items,   setItems]     = useState<ItemRow[]>([]);
  const [partners,setPartners]  = useState<PartnerRow[]>([]);
  const [matchups,setMatchups]  = useState<MatchupRow[]>([]);
  const [section, setSection]   = useState<SectionTab>('moves');

  useEffect(() => {
    if (!decoded) return;
    setLoading(true);
    setError(null);
    fetchPokemonData(decoded, null)
      .then(result => {
        setStats(result.stats);
        setMoves(result.moves);
        setItems(result.items);
        setPartners(result.partners);
        setMatchups(result.matchups);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [decoded]);

  if (!decoded) {
    return (
      <div className="profile-page">
        <div className="profile-empty">No Pokemon selected.</div>
      </div>
    );
  }

  const partnerChartData = partners.slice(0, 15).map(p => ({
    name: p.partner_species,
    usage: p.usage_pct,
    winRate: p.win_rate,
  }));

  const SECTION_TABS: { value: SectionTab; label: string }[] = [
    { value: 'moves',    label: 'Moves'    },
    { value: 'items',    label: 'Items'    },
    { value: 'partners', label: 'Partners' },
    { value: 'matchups', label: 'Matchups' },
  ];

  return (
    <div className="profile-page">
      <Link to="/" className="back-link">
        <i className="bi bi-arrow-left" /> Back to Metagame
      </Link>

      {/* Hero */}
      <div className="pokemon-hero">
        <img
          src={spriteUrl(decoded)}
          alt={decoded}
          className="pokemon-hero__sprite"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="pokemon-hero__info">
          <h2 className="profile-title">{decoded}</h2>
          {stats && (
            <div className="pokemon-hero__stats">
              <StatBadge label="Usage"    value={pct(stats.usage_pct)} />
              <StatBadge label="Win Rate" value={pct(stats.win_rate)} />
              <StatBadge label="Teams"    value={stats.teams.toLocaleString()} />
            </div>
          )}
        </div>
      </div>

      {loading && <div className="table-status">Loading...</div>}
      {error   && <div className="table-status table-error">{error}</div>}

      {!loading && !error && (
        <>
          {/* Section tabs */}
          <div className="pokemon-tabs">
            {SECTION_TABS.map(({ value, label }) => (
              <button
                key={value}
                className={section === value ? 'pokemon-tab active' : 'pokemon-tab'}
                onClick={() => setSection(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {section === 'moves' && (
            <DataSection
              title="Moves"
              data={moves}
              renderRow={(row, i) => (
                <tr key={i} className="pokemon-table__row">
                  <td className="pokemon-table__name">{row.move_name}</td>
                  <td className="pokemon-table__teams">{row.teams} teams</td>
                  <td className="pokemon-table__wr"><WinRateBar value={row.win_rate} /></td>
                </tr>
              )}
            />
          )}

          {section === 'items' && (
            <DataSection
              title="Items"
              data={items}
              renderRow={(row, i) => (
                <tr key={i} className="pokemon-table__row">
                  <td className="pokemon-table__name">{row.item}</td>
                  <td className="pokemon-table__teams">{row.teams} teams</td>
                  <td className="pokemon-table__wr"><WinRateBar value={row.win_rate} /></td>
                </tr>
              )}
            />
          )}

          {section === 'partners' && (
            <>
              <UsageChart data={partnerChartData} />
              <DataSection
                title="Partner Pokemon"
                data={partners}
                renderRow={(row, i) => (
                  <tr key={i} className="pokemon-table__row">
                    <td className="pokemon-table__name">
                      <Link to={`/pokemon/${encodeURIComponent(row.partner_species)}`} className="cell-link">
                        {row.partner_species}
                      </Link>
                    </td>
                    <td className="pokemon-table__teams">{row.teams} teams</td>
                    <td className="pokemon-table__usage">{pct(row.usage_pct)} usage</td>
                    <td className="pokemon-table__wr"><WinRateBar value={row.win_rate} /></td>
                  </tr>
                )}
              />
            </>
          )}

          {section === 'matchups' && (
            <DataSection
              title="Matchups"
              data={matchups}
              renderRow={(row, i) => (
                <tr key={i} className="pokemon-table__row">
                  <td className="pokemon-table__name">
                    <Link to={`/pokemon/${encodeURIComponent(row.opponent_species)}`} className="cell-link">
                      {row.opponent_species}
                    </Link>
                  </td>
                  <td className="pokemon-table__teams">{row.matches} matches</td>
                  <td className="pokemon-table__wr"><WinRateBar value={row.win_rate} /></td>
                </tr>
              )}
            />
          )}
        </>
      )}
    </div>
  );
}
