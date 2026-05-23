import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { TeamIcons } from '../components/TeamIcons';
import { PokemonIcon } from '../components/PokemonIcon';
import './ProfilePage.css';
import './TeamsPage.css';

interface PokemonSlot {
  species: string;
  item:    string;
  moves:   string[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamRecord {
  tournament_id:   string;
  tournament_name: string;
  placing:         number;
  player_id:       string;
  player_name:     string;
  country:         string;
  wins:            number;
  losses:          number;
  win_rate:        number;
  team:            string[];
  roster:          PokemonSlot[];
}

interface SlotCriteria {
  pokemon: string;
  item:    string;
  moves:   string[];
}

type TabId = 'search' | 'trending';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptySlot = (): SlotCriteria => ({ pokemon: '', item: '', moves: ['', '', '', ''] });

function slotHasCriteria(s: SlotCriteria) {
  return s.pokemon.trim() || s.item.trim() || s.moves.some((m) => m.trim());
}

function slotMatches(slot: PokemonSlot, criteria: SlotCriteria): boolean {
  const pq  = criteria.pokemon.trim().toLowerCase();
  const iq  = criteria.item.trim().toLowerCase();
  const mqs = criteria.moves.map((m) => m.trim().toLowerCase()).filter(Boolean);

  if (pq) {
    if (ALL_TYPES_SET.has(pq)) {
      const types = (POKEMON_TYPES[slot.species] ?? []).map((t) => t.toLowerCase());
      if (!types.includes(pq)) return false;
    } else {
      if (!slot.species.toLowerCase().includes(pq)) return false;
    }
  }

  if (iq && !slot.item.toLowerCase().includes(iq)) return false;

  for (const mq of mqs) {
    const isCat  = (MOVE_CATEGORIES as string[]).map((c) => c.toLowerCase()).includes(mq);
    const isType = ALL_TYPES_SET.has(mq);
    const matches = slot.moves.some((name) => {
      const meta = MOVE_META[name];
      if (isCat)  return meta?.category.toLowerCase() === mq;
      if (isType) return meta?.type.toLowerCase() === mq;
      return name.toLowerCase().includes(mq);
    });
    if (!matches) return false;
  }

  return true;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

interface RawTeamRow {
  tournament_id:   string;
  tournament_name: string;
  placing:         number;
  player_id:       number;
  player_name:     string;
  country:         string | null;
  wins:            number;
  losses:          number;
  roster:          PokemonSlot[];
}

function toTeamRecord(r: RawTeamRow): TeamRecord {
  const roster = r.roster ?? [];
  return {
    tournament_id:   r.tournament_id,
    tournament_name: r.tournament_name,
    placing:         r.placing ?? 9999,
    player_id:       String(r.player_id),
    player_name:     r.player_name,
    country:         r.country ?? '',
    wins:            r.wins,
    losses:          r.losses,
    win_rate:        r.wins / Math.max(r.wins + r.losses, 1) * 100,
    team:            roster.map((s) => s.species),
    roster,
  };
}

// ─── Type / category lookup tables ───────────────────────────────────────────

const ALL_TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison',
  'Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy',
];
const ALL_TYPES_SET = new Set(ALL_TYPES.map((t) => t.toLowerCase()));

const POKEMON_TYPES: Record<string, string[]> = {
  Garchomp:  ['Dragon', 'Ground'],
  Mewtwo:    ['Psychic'],
  Groudon:   ['Ground'],
  Kyogre:    ['Water'],
  Rayquaza:  ['Dragon', 'Flying'],
  Gengar:    ['Ghost', 'Poison'],
  Charizard: ['Fire', 'Flying'],
  Blaziken:  ['Fire', 'Fighting'],
  Blastoise: ['Water'],
  Salamence: ['Dragon', 'Flying'],
  Lucario:   ['Fighting', 'Steel'],
  Medicham:  ['Fighting', 'Psychic'],
  Venusaur:  ['Grass', 'Poison'],
  Swampert:  ['Water', 'Ground'],
};

type MoveCategory = 'Physical' | 'Special' | 'Status';
interface MoveMeta { type: string; category: MoveCategory; }

const MOVE_META: Record<string, MoveMeta> = {
  'Earthquake':        { type: 'Ground',   category: 'Physical' },
  'Dragon Claw':       { type: 'Dragon',   category: 'Physical' },
  'Stone Edge':        { type: 'Rock',     category: 'Physical' },
  'Protect':           { type: 'Normal',   category: 'Status'   },
  'Psystrike':         { type: 'Psychic',  category: 'Special'  },
  'Ice Beam':          { type: 'Ice',      category: 'Special'  },
  'Aura Sphere':       { type: 'Fighting', category: 'Special'  },
  'Precipice Blades':  { type: 'Ground',   category: 'Physical' },
  'Rock Slide':        { type: 'Rock',     category: 'Physical' },
  'Fire Punch':        { type: 'Fire',     category: 'Physical' },
  'Origin Pulse':      { type: 'Water',    category: 'Special'  },
  'Thunder':           { type: 'Electric', category: 'Special'  },
  'Dragon Ascent':     { type: 'Flying',   category: 'Physical' },
  'Extreme Speed':     { type: 'Normal',   category: 'Physical' },
  'Shadow Ball':       { type: 'Ghost',    category: 'Special'  },
  'Sludge Bomb':       { type: 'Poison',   category: 'Special'  },
  'Dazzling Gleam':    { type: 'Fairy',    category: 'Special'  },
  'Trick':             { type: 'Psychic',  category: 'Status'   },
  'Outrage':           { type: 'Dragon',   category: 'Physical' },
  'High Jump Kick':    { type: 'Fighting', category: 'Physical' },
  'Flare Blitz':       { type: 'Fire',     category: 'Physical' },
  'Scald':             { type: 'Water',    category: 'Special'  },
  'Dark Pulse':        { type: 'Dark',     category: 'Special'  },
  'Double-Edge':       { type: 'Normal',   category: 'Physical' },
  'Close Combat':      { type: 'Fighting', category: 'Physical' },
  'Flash Cannon':      { type: 'Steel',    category: 'Special'  },
  'Thunder Punch':     { type: 'Electric', category: 'Physical' },
  'Will-O-Wisp':       { type: 'Fire',     category: 'Status'   },
  'Fake Out':          { type: 'Normal',   category: 'Physical' },
  'Ice Punch':         { type: 'Ice',      category: 'Physical' },
  'V-Create':          { type: 'Fire',     category: 'Physical' },
  'Petal Blizzard':    { type: 'Grass',    category: 'Physical' },
  'Synthesis':         { type: 'Grass',    category: 'Status'   },
  'Waterfall':         { type: 'Water',    category: 'Physical' },
  'Heat Wave':         { type: 'Fire',     category: 'Special'  },
  'Solar Beam':        { type: 'Grass',    category: 'Special'  },
  'Air Slash':         { type: 'Flying',   category: 'Special'  },
  'Overheat':          { type: 'Fire',     category: 'Special'  },
  'Focus Blast':       { type: 'Fighting', category: 'Special'  },
  'Draco Meteor':      { type: 'Dragon',   category: 'Special'  },
  'Hyper Voice':       { type: 'Normal',   category: 'Special'  },
  'Flamethrower':      { type: 'Fire',     category: 'Special'  },
  'Stealth Rock':      { type: 'Rock',     category: 'Status'   },
  'Thunderbolt':       { type: 'Electric', category: 'Special'  },
  'Superpower':        { type: 'Fighting', category: 'Physical' },
  'Sleep Powder':      { type: 'Grass',    category: 'Status'   },
  'Charizardite X':    { type: 'Normal',   category: 'Status'   }, // placeholder — items shouldn't appear
};

const MOVE_CATEGORIES: MoveCategory[] = ['Physical', 'Special', 'Status'];

// ─── Option lists ─────────────────────────────────────────────────────────────

function buildOptions(teams: TeamRecord[]) {
  const flat = teams.flatMap((t) => t.roster);
  const pokemonNames  = [...new Set(flat.map((s) => s.species))].sort();
  const itemOptions   = [...new Set(flat.map((s) => s.item).filter((i) => i && i !== 'None' && i !== ''))].sort();
  const moveNames     = [...new Set(flat.flatMap((s) => s.moves).filter(Boolean))].sort();
  return {
    pokemonOptions: [...pokemonNames, ...ALL_TYPES].sort(),
    itemOptions,
    moveOptions: [...moveNames, ...ALL_TYPES, ...MOVE_CATEGORIES].sort(),
  };
}

const PASTE_URL = 'https://pokepast.es/6dbe083ec3d8afa2';

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function itemIconUrl(name: string) {
  return `https://play.pokemonshowdown.com/sprites/itemicons/${
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }.png`;
}

const TYPE_COLORS: Record<string, string> = {
  Normal:   '#9099A1', Fire:     '#FF9D55', Water:    '#5090D6',
  Electric: '#F4D23C', Grass:    '#63BC5A', Ice:      '#74CEC0',
  Fighting: '#CE406A', Poison:   '#AB6ACA', Ground:   '#D97746',
  Flying:   '#89AAE3', Psychic:  '#FA7179', Bug:      '#91A119',
  Rock:     '#C5B78C', Ghost:    '#5269AD', Dragon:   '#0B6AC3',
  Dark:     '#5B5466', Steel:    '#5A8EA2', Fairy:    '#EC8FE6',
};

const CATEGORY_COLORS: Record<string, string> = {
  Physical: '#C92112', Special: '#4F60E2', Status: '#7A7887',
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="type-badge" style={{ background: TYPE_COLORS[type] ?? '#888' }}>
      {type}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="type-badge" style={{ background: CATEGORY_COLORS[category] ?? '#888' }}>
      {category}
    </span>
  );
}

// ─── Autocomplete input ───────────────────────────────────────────────────────

interface AutocompleteInputProps {
  value:       string;
  onChange:    (val: string) => void;
  options:     string[];
  placeholder: string;
  iconType?:   'pokemon' | 'item';
  className?:  string;
}

function AutocompleteInput({ value, onChange, options, placeholder, iconType, className }: AutocompleteInputProps) {
  const [draft, setDraft] = useState(value);
  const [open,  setOpen]  = useState(false);
  const focused           = useRef(false);

  // Sync draft when committed value is cleared externally while not focused
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const filtered = useMemo(
    () => draft.trim()
      ? options.filter((o) => o.toLowerCase().includes(draft.toLowerCase())).slice(0, 8)
      : [],
    [draft, options],
  );

  const select = (opt: string) => {
    onChange(opt);
    setDraft(opt);
    setOpen(false);
  };

  return (
    <div className="teams-autocomplete">
      <input
        className={`teams-slot-input${className ? ` ${className}` : ''}`}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          const val = e.target.value;
          setDraft(val);
          if (!val) { onChange(''); setOpen(false); } else { setOpen(true); }
        }}
        onFocus={() => { focused.current = true; if (draft.trim()) setOpen(true); }}
        onBlur={() => {
          focused.current = false;
          // Delay so onMouseDown on an option fires before we close
          setTimeout(() => { setOpen(false); setDraft(value); }, 150);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="teams-dropdown">
          {filtered.map((opt) => {
            const isType = ALL_TYPES_SET.has(opt.toLowerCase());
            const isCat  = (MOVE_CATEGORIES as string[]).includes(opt);
            return (
              <button
                key={opt}
                className="teams-dropdown__item"
                onMouseDown={(e) => { e.preventDefault(); select(opt); }}
              >
                {isType ? <TypeBadge type={opt} /> :
                 isCat  ? <CategoryBadge category={opt} /> :
                 iconType === 'pokemon' ? (
                   <><PokemonIcon species={opt} size="small" className="teams-dropdown__sprite" />{opt}</>
                 ) : iconType === 'item' ? (
                   <><img src={itemIconUrl(opt)} alt="" className="teams-dropdown__item-icon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />{opt}</>
                 ) : opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Teams table ──────────────────────────────────────────────────────────────

function TeamsTable({ rows }: { rows: TeamRecord[] }) {
  return (
    <table className="profile-table profile-table--teams">
      <thead>
        <tr>
          <th className="right">#</th>
          <th>Player</th>
          <th>Tournament</th>
          <th className="right">W–L</th>
          <th>Team</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.tournament_id}-${r.placing}-${i}`}>
            <td className="profile-table__num">#{r.placing}</td>
            <td className="profile-table__name">
              <Link to={`/players/${r.player_id}`} className="cell-link">
                {r.country && <span style={{ marginRight: 6, fontSize: 14 }}>{r.country}</span>}
                {r.player_name}
              </Link>
            </td>
            <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
              <Link to={`/tournaments/${r.tournament_id}`} className="cell-link">
                {r.tournament_name}
              </Link>
            </td>
            <td className="profile-table__num">
              <span style={{ color: 'var(--green)' }}>{r.wins}</span>
              <span style={{ color: 'var(--text-4)', margin: '0 2px' }}>–</span>
              <span style={{ color: 'var(--red)' }}>{r.losses}</span>
            </td>
            <td>
              <TeamIcons team={r.team} pasteUrl={PASTE_URL} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Slot form (expanded) ─────────────────────────────────────────────────────

interface SlotFormProps {
  slot:           SlotCriteria;
  onChange:       (next: SlotCriteria) => void;
  pokemonOptions: string[];
  itemOptions:    string[];
  moveOptions:    string[];
}

function SlotForm({ slot, onChange, pokemonOptions, itemOptions, moveOptions }: SlotFormProps) {
  const setField = (field: 'pokemon' | 'item', val: string) =>
    onChange({ ...slot, [field]: val });

  const setMove = (idx: number, val: string) =>
    onChange({ ...slot, moves: slot.moves.map((m, i) => (i === idx ? val : m)) });

  return (
    <div className="teams-slot-form">
      <div className="teams-slot-row">
        <span className="teams-slot-label">Pokémon</span>
        <AutocompleteInput
          value={slot.pokemon}
          onChange={(v) => setField('pokemon', v)}
          options={pokemonOptions}
          placeholder="Any Pokémon"
          iconType="pokemon"
        />
      </div>

      <div className="teams-slot-row">
        <span className="teams-slot-label">Item</span>
        <AutocompleteInput
          value={slot.item}
          onChange={(v) => setField('item', v)}
          options={itemOptions}
          placeholder="Any item"
          iconType="item"
        />
      </div>

      {slot.moves.map((move, idx) => (
        <div className="teams-slot-row" key={idx}>
          <span className="teams-slot-label">{idx === 0 ? 'Move' : ''}</span>
          <AutocompleteInput
            value={move}
            onChange={(v) => setMove(idx, v)}
            options={moveOptions}
            placeholder={`Move ${idx + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Search tab ───────────────────────────────────────────────────────────────

interface SearchTabProps {
  allTeams:       TeamRecord[];
  pokemonOptions: string[];
  itemOptions:    string[];
  moveOptions:    string[];
}

function SearchTab({ allTeams, pokemonOptions, itemOptions, moveOptions }: SearchTabProps) {
  const [slots,     setSlots]     = useState<SlotCriteria[]>(() => Array.from({ length: 6 }, emptySlot));
  const [activeIdx, setActiveIdx] = useState(0);

  const updateActive = (next: SlotCriteria) =>
    setSlots((prev) => prev.map((s, i) => (i === activeIdx ? next : s)));

  const clearSlot = (idx: number) =>
    setSlots((prev) => prev.map((s, i) => (i === idx ? emptySlot() : s)));

  const activeSlots = slots.filter(slotHasCriteria);

  const results = useMemo(() => {
    if (!activeSlots.length) return null;
    return allTeams.filter((team) =>
      activeSlots.every((criteria) => team.roster.some((slot) => slotMatches(slot, criteria))),
    );
  }, [slots, allTeams]);

  return (
    <div className="profile-body">
      <div className="teams-search-layout">
        <div className="teams-tray">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className={`teams-tray-item${activeIdx === idx ? ' active' : ''}`}
              onClick={() => setActiveIdx(idx)}
            >
              {slot.pokemon.trim() && (
                ALL_TYPES_SET.has(slot.pokemon.trim().toLowerCase())
                  ? <TypeBadge type={slot.pokemon.trim()} />
                  : <PokemonIcon species={slot.pokemon} size="small" className="teams-tray-item__sprite" />
              )}
              <span className={`teams-tray-item__name${!slot.pokemon.trim() ? ' empty' : ''}`}>
                {slot.pokemon.trim() || 'Any Pokémon'}
              </span>
              <button
                className="teams-tray-item__btn"
                title="Clear"
                onClick={(e) => { e.stopPropagation(); clearSlot(idx); }}
              >
                <i className="bi bi-eraser" />
              </button>
            </div>
          ))}
        </div>

        <div className="teams-slot-panel">
          <SlotForm
            slot={slots[activeIdx]}
            onChange={updateActive}
            pokemonOptions={pokemonOptions}
            itemOptions={itemOptions}
            moveOptions={moveOptions}
          />
        </div>
      </div>

      {!activeSlots.length && (
        <div className="teams-empty">
          Fill in any combination of Pokémon, item, or moves to find matching teams.
        </div>
      )}
      {results !== null && results.length === 0 && (
        <div className="teams-empty">No teams found matching those criteria.</div>
      )}
      {results !== null && results.length > 0 && (
        <>
          <p className="teams-results-count">{results.length} team{results.length !== 1 ? 's' : ''} found</p>
          <TeamsTable rows={results} />
        </>
      )}
    </div>
  );
}

// ─── Trending tab ─────────────────────────────────────────────────────────────

function TrendingTab({ allTeams }: { allTeams: TeamRecord[] }) {
  const trending = useMemo(() =>
    [...allTeams].sort((a, b) => b.win_rate - a.win_rate || a.placing - b.placing).slice(0, 20),
  [allTeams]);

  return (
    <div className="profile-body">
      <p className="teams-trending-label">Top win rate · all M-A tournaments</p>
      <TeamsTable rows={trending} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TeamsPage() {
  const [tab,      setTab]      = useState<TabId>('search');
  const [allTeams, setAllTeams] = useState<TeamRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('get_teams_with_rosters', { p_mode: 'all', p_limit: 2000 })
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setAllTeams(((data ?? []) as RawTeamRow[]).map(toTeamRecord));
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => buildOptions(allTeams), [allTeams]);
  const tournamentCount = useMemo(
    () => new Set(allTeams.map((t) => t.tournament_id)).size,
    [allTeams],
  );

  return (
    <div className="profile-page">
      <div className="profile-hero" style={{ minHeight: 'auto', padding: '28px 36px 24px' }}>
        <div className="profile-hero__content">
          <h1 className="profile-name">Teams</h1>
          {loading ? (
            <div className="profile-stats">
              <div className="skel" style={{ width: 80, height: 40 }} />
              <div className="skel" style={{ width: 80, height: 40, marginLeft: 16 }} />
            </div>
          ) : (
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat__value">{allTeams.length.toLocaleString()}</span>
                <span className="profile-stat__label">Teams</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat__value">{tournamentCount}</span>
                <span className="profile-stat__label">Tournaments</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="profile-tabs">
        <button
          className={`profile-tab${tab === 'search' ? ' active' : ''}`}
          onClick={() => setTab('search')}
        >
          Search
        </button>
        <button
          className={`profile-tab${tab === 'trending' ? ' active' : ''}`}
          onClick={() => setTab('trending')}
        >
          Trending
        </button>
      </div>

      {error && <div className="list-page__error" style={{ margin: '24px 36px' }}>{error}</div>}

      {tab === 'search' && (
        <SearchTab
          allTeams={allTeams}
          pokemonOptions={options.pokemonOptions}
          itemOptions={options.itemOptions}
          moveOptions={options.moveOptions}
        />
      )}
      {tab === 'trending' && <TrendingTab allTeams={allTeams} />}
    </div>
  );
}
