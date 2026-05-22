import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_TOURNAMENT_STANDINGS, MOCK_TOURNAMENTS, TEAMS, TEAM_ROSTERS, type PokemonSlot } from '../mock-data';
import { TeamIcons } from '../components/TeamIcons';
import { PokemonIcon } from '../components/PokemonIcon';
import './ProfilePage.css';
import './TeamsPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamRecord {
  tournament_id:   string;
  tournament_name: string;
  placing:         number;
  player_id:       string;
  player_name:     string;
  flag:            string;
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

// ─── Mock data ────────────────────────────────────────────────────────────────

const ROSTER_BY_KEY = new Map<string, PokemonSlot[]>(
  TEAMS.map((t, i) => [t.join('|'), TEAM_ROSTERS[i]]),
);

const FALLBACK_ROSTER = (team: string[]): PokemonSlot[] =>
  team.map((species) => ({ species, item: '', moves: [] }));

const ALL_TEAMS: TeamRecord[] = Object.entries(MOCK_TOURNAMENT_STANDINGS)
  .filter(([id]) => id !== 'default')
  .flatMap(([tournamentId, standings]) => {
    const t = MOCK_TOURNAMENTS.find((t) => t.id === tournamentId);
    return standings.map((s) => ({
      tournament_id:   tournamentId,
      tournament_name: t?.name ?? tournamentId,
      placing:         s.placing,
      player_id:       s.player_id,
      player_name:     s.player_name,
      flag:            s.flag,
      wins:            s.wins,
      losses:          s.losses,
      win_rate:        s.wins / (s.wins + s.losses) * 100,
      team:            s.team,
      roster:          ROSTER_BY_KEY.get(s.team.join('|')) ?? FALLBACK_ROSTER(s.team),
    }));
  });

const TRENDING_TEAMS = [...ALL_TEAMS]
  .sort((a, b) => b.win_rate - a.win_rate || a.placing - b.placing)
  .slice(0, 20);

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

const flat = TEAM_ROSTERS.flat();
const POKEMON_NAMES   = [...new Set(flat.map((s) => s.species))].sort();
const POKEMON_OPTIONS = [...POKEMON_NAMES, ...ALL_TYPES].sort();
const ITEM_OPTIONS    = [...new Set(flat.map((s) => s.item).filter((i) => i !== 'None'))].sort();
const MOVE_NAMES      = [...new Set(flat.flatMap((s) => s.moves))].sort();
const MOVE_OPTIONS    = [...MOVE_NAMES, ...ALL_TYPES, ...MOVE_CATEGORIES].sort();

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
                <span style={{ marginRight: 6 }}>{r.flag}</span>
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
  slot:     SlotCriteria;
  onChange: (next: SlotCriteria) => void;
}

function SlotForm({ slot, onChange }: SlotFormProps) {
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
          options={POKEMON_OPTIONS}
          placeholder="Any Pokémon"
          iconType="pokemon"
        />
      </div>

      <div className="teams-slot-row">
        <span className="teams-slot-label">Item</span>
        <AutocompleteInput
          value={slot.item}
          onChange={(v) => setField('item', v)}
          options={ITEM_OPTIONS}
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
            options={MOVE_OPTIONS}
            placeholder={`Move ${idx + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Search tab ───────────────────────────────────────────────────────────────

function SearchTab() {
  const [slots,     setSlots]     = useState<SlotCriteria[]>(() => Array.from({ length: 6 }, emptySlot));
  const [activeIdx, setActiveIdx] = useState(0);

  const updateActive = (next: SlotCriteria) =>
    setSlots((prev) => prev.map((s, i) => (i === activeIdx ? next : s)));

  const clearSlot = (idx: number) =>
    setSlots((prev) => prev.map((s, i) => (i === idx ? emptySlot() : s)));

  const activeSlots = slots.filter(slotHasCriteria);

  const results = useMemo(() => {
    if (!activeSlots.length) return null;
    return ALL_TEAMS.filter((team) =>
      activeSlots.every((criteria) => team.roster.some((slot) => slotMatches(slot, criteria))),
    );
  }, [slots]);

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
          <SlotForm slot={slots[activeIdx]} onChange={updateActive} />
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

function TrendingTab() {
  return (
    <div className="profile-body">
      <p className="teams-trending-label">Top win rate · all M-A tournaments</p>
      <TeamsTable rows={TRENDING_TEAMS} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TeamsPage() {
  const [tab, setTab] = useState<TabId>('search');

  return (
    <div className="profile-page">
      <div className="profile-hero" style={{ minHeight: 'auto', padding: '28px 36px 24px' }}>
        <div className="profile-hero__content">
          <h1 className="profile-name">Teams</h1>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat__value">{ALL_TEAMS.length}</span>
              <span className="profile-stat__label">Teams</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{MOCK_TOURNAMENTS.length}</span>
              <span className="profile-stat__label">Tournaments</span>
            </div>
          </div>
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

      {tab === 'search'   && <SearchTab />}
      {tab === 'trending' && <TrendingTab />}
    </div>
  );
}
