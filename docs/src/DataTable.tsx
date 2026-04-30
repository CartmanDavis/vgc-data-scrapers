import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { supabase } from './supabase';
import './DataTable.css';

ModuleRegistry.registerModules([AllCommunityModule]);

// ─── Types ────────────────────────────────────────────────────────────────────

type Dataset    = 'pokemon' | 'mega' | 'h2h' | 'combos' | 'teammates' | 'detail';
type Mode       = 'all' | 'topcut';
type DetailTab  = 'moves' | 'items' | 'partners' | 'matchups';

// ─── URL state helpers ────────────────────────────────────────────────────────

const VALID_DATASETS  = new Set<Dataset>(['pokemon','mega','h2h','combos','teammates','detail']);
const VALID_MODES     = new Set<Mode>(['all','topcut']);
const VALID_DETAIL    = new Set<DetailTab>(['moves','items','partners','matchups']);

function parseSortParam(s: string | null): string | null {
  if (!s) return null;
  const [colId, dir] = s.split(':');
  return colId && (dir === 'asc' || dir === 'desc') ? s : null;
}

function parseFilterParam(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const tab      = p.get('tab') as Dataset;
  const mode     = p.get('mode') as Mode;
  const detail   = p.get('detail') as DetailTab;
  const sinceRaw = p.get('since');
  return {
    dataset:         VALID_DATASETS.has(tab)   ? tab    : 'pokemon'  as Dataset,
    mode:            VALID_MODES.has(mode)      ? mode   : 'all'      as Mode,
    sinceDays:       sinceRaw                   ? Number(sinceRaw)    : null as number | null,
    selectedMega:    p.get('mega')    ?? '',
    selectedSpecies: p.get('species') ?? '',
    detailTab:       VALID_DETAIL.has(detail)   ? detail : 'moves'    as DetailTab,
    sortParam:       parseSortParam(p.get('sort')),
    filterParam:     parseFilterParam(p.get('filter')),
  };
}

// ─── Date presets ─────────────────────────────────────────────────────────────

const DATE_PRESETS: { label: string; days: number | null }[] = [
  { label: 'All Time', days: null },
  { label: 'Last 7d',  days: 7   },
  { label: 'Last 14d', days: 14  },
  { label: 'Last 30d', days: 30  },
];

function toSince(days: number | null): string | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ─── Column helpers ───────────────────────────────────────────────────────────

const pctFmt = (p: { value: unknown }) => {
  const v = Number(p.value);
  return isNaN(v) ? '-' : `${v.toFixed(1)}%`;
};
const numCmp = (a: unknown, b: unknown) => (Number(a) || 0) - (Number(b) || 0);

function nameCol(field: string, header: string, flex = 2): ColDef {
  return { field, headerName: header, flex, minWidth: 110, cellClass: 'string-cell', sortable: true, filter: true };
}
function pctCol(field: string, header: string, sort?: 'asc' | 'desc'): ColDef {
  return {
    field, headerName: header, flex: 1, minWidth: 90,
    sortable: true, comparator: numCmp, valueFormatter: pctFmt,
    ...(sort ? { initialSort: sort, sortIndex: 0 } : {}),
  };
}
function numCol(field: string, header: string): ColDef {
  return { field, headerName: header, flex: 1, minWidth: 80, sortable: true, comparator: numCmp };
}

// ─── Column definitions per dataset / mode ────────────────────────────────────

type ModeColDef = Record<Mode, ColDef[]>;

const NAME_COLS: Record<Exclude<Dataset, 'teammates' | 'detail'>, ColDef[]> = {
  pokemon: [nameCol('species', 'Pokemon')],
  mega:    [nameCol('pokemon', 'Mega Item')],
  h2h:     [nameCol('mega1', 'Mega', 1.5), nameCol('mega2', 'Opponent', 1.5)],
  combos:  [nameCol('combo', 'Combo', 3)],
};

const MODE_COLS: Record<Exclude<Dataset, 'teammates' | 'detail'>, ModeColDef> = {
  pokemon: {
    all:    [numCol('teams','Teams'), pctCol('usage_pct','Usage %','desc'), pctCol('win_rate','Win Rate')],
    topcut: [numCol('top_cut_teams','Teams'), pctCol('top_cut_usage','Usage %','desc'), pctCol('top_cut_wr','Win Rate')],
  },
  mega: {
    all:    [numCol('teams','Teams'), pctCol('usage_pct','Usage %','desc'), pctCol('win_rate','Win Rate')],
    topcut: [numCol('top_cut_teams','Teams'), pctCol('top_cut_usage','Usage %','desc'), pctCol('top_cut_wr','Win Rate')],
  },
  h2h: {
    all:    [numCol('matches','Matches'), numCol('mega1_wins','Wins'), numCol('mega2_wins','Opp Wins'), pctCol('mega1_wr','Win Rate')],
    topcut: [numCol('top_cut_matches','Matches'), numCol('top_cut_mega1_wins','Wins'), numCol('top_cut_mega2_wins','Opp Wins'), pctCol('top_cut_mega1_wr','Win Rate')],
  },
  combos: {
    all:    [numCol('teams','Teams'), pctCol('usage_pct','Usage %','desc'), pctCol('win_rate','Win Rate')],
    topcut: [numCol('top_cut_teams','Teams'), pctCol('top_cut_usage','Usage %','desc'), pctCol('top_cut_wr','Win Rate')],
  },
};

const TEAMMATES_COLS: ColDef[] = [
  nameCol('species', 'Pokemon'),
  numCol('teams', 'Teams'),
  pctCol('usage_pct', 'Usage %', 'desc'),
  pctCol('win_rate_with', 'WR With'),
  pctCol('win_rate_without', 'WR Without'),
];

const DETAIL_COLS: Record<DetailTab, ColDef[]> = {
  moves:    [nameCol('move_name','Move'), numCol('teams','Teams'), pctCol('win_rate','Win Rate','desc')],
  items:    [nameCol('item','Item'), numCol('teams','Teams'), pctCol('win_rate','Win Rate','desc')],
  partners: [nameCol('partner_species','Partner'), numCol('teams','Teams'), pctCol('usage_pct','Usage %','desc'), pctCol('win_rate','Win Rate')],
  matchups: [nameCol('opponent_species','Opponent'), numCol('matches','Matches'), numCol('wins','Wins'), pctCol('win_rate','Win Rate','desc')],
};

// ─── Data fetching ────────────────────────────────────────────────────────────

const cache: Record<string, unknown[]> = {};

type RpcCall = { fn: string; params?: Record<string, unknown> };

function rpcKey(fn: string, params: Record<string, unknown> = {}): string {
  return `${fn}:${JSON.stringify(params)}`;
}

async function rpc(fn: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
  const key = rpcKey(fn, params);
  if (cache[key]) return cache[key];
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  cache[key] = data as unknown[];
  return data as unknown[];
}

// ─── Dataset tabs ─────────────────────────────────────────────────────────────

const DATASETS: { value: Dataset; label: string }[] = [
  { value: 'pokemon',   label: 'Pokemon Usage' },
  { value: 'mega',      label: 'Mega Usage'     },
  { value: 'h2h',       label: 'Mega H2H'       },
  { value: 'combos',    label: 'Mega Combos'    },
  { value: 'teammates', label: 'Teammates'      },
  { value: 'detail',    label: 'Pokemon Detail' },
];

const MODES: { value: Mode; label: string }[] = [
  { value: 'all',    label: 'All'      },
  { value: 'topcut', label: 'Top Cut'  },
];

const DETAIL_TABS: { value: DetailTab; label: string }[] = [
  { value: 'moves',    label: 'Moves'    },
  { value: 'items',    label: 'Items'    },
  { value: 'partners', label: 'Partners' },
  { value: 'matchups', label: 'Matchups' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable() {
  const init = useMemo(readUrl, []);

  const [dataset,         setDataset]         = useState<Dataset>(init.dataset);
  const [mode,            setMode]             = useState<Mode>(init.mode);
  const [sinceDays,       setSinceDays]        = useState<number | null>(init.sinceDays);
  const [rows,            setRows]             = useState<unknown[]>([]);
  const [loading,         setLoading]          = useState(false);
  const [error,           setError]            = useState<string | null>(null);

  // Teammates tab
  const [megaList,        setMegaList]         = useState<string[]>([]);
  const [selectedMega,    setSelectedMega]     = useState<string>(init.selectedMega);

  // Detail tab
  const [speciesList,     setSpeciesList]      = useState<string[]>([]);
  const [selectedSpecies, setSelectedSpecies]  = useState<string>(init.selectedSpecies);
  const [detailTab,       setDetailTab]        = useState<DetailTab>(init.detailTab);

  // Sort + filter state — kept in refs so grid callbacks don't need to re-bind
  const [sortParam,   setSortParam]   = useState<string | null>(init.sortParam);
  const [filterParam, setFilterParam] = useState<Record<string, unknown> | null>(init.filterParam);
  const sortParamRef   = useRef(sortParam);
  const filterParamRef = useRef(filterParam);
  useEffect(() => { sortParamRef.current   = sortParam;   }, [sortParam]);
  useEffect(() => { filterParamRef.current = filterParam; }, [filterParam]);

  const gridRef = useRef<AgGridReact>(null);

  const since = toSince(sinceDays);

  // Sync all UI state → URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (dataset !== 'pokemon')  p.set('tab',     dataset);
    if (mode !== 'all')         p.set('mode',    mode);
    if (sinceDays !== null)     p.set('since',   String(sinceDays));
    if (selectedMega)           p.set('mega',    selectedMega);
    if (selectedSpecies)        p.set('species', selectedSpecies);
    if (detailTab !== 'moves')  p.set('detail',  detailTab);
    if (sortParam)              p.set('sort',    sortParam);
    if (filterParam)            p.set('filter',  JSON.stringify(filterParam));
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [dataset, mode, sinceDays, selectedMega, selectedSpecies, detailTab, sortParam, filterParam]);

  // Apply sort + filter from URL when grid (re)mounts
  const onGridReady = useCallback(() => {
    if (!gridRef.current) return;
    const sp = sortParamRef.current;
    if (sp) {
      const [colId, dir] = sp.split(':');
      gridRef.current.api.applyColumnState({
        state: [{ colId, sort: dir as 'asc' | 'desc' }],
        defaultState: { sort: null },
      });
    }
    const fp = filterParamRef.current;
    if (fp) gridRef.current.api.setFilterModel(fp);
  }, []);

  // Capture sort changes → state → URL
  const onSortChanged = useCallback(() => {
    if (!gridRef.current) return;
    const sorted = gridRef.current.api.getColumnState().find(c => c.sort);
    setSortParam(sorted ? `${sorted.colId}:${sorted.sort}` : null);
  }, []);

  // Capture filter changes → state → URL
  const onFilterChanged = useCallback(() => {
    if (!gridRef.current) return;
    const model = gridRef.current.api.getFilterModel();
    setFilterParam(Object.keys(model).length ? model : null);
  }, []);

  // Load species + mega lists once (from pokemon/mega usage data)
  useEffect(() => {
    rpc('get_pokemon_usage', since ? { p_since: since } : {})
      .then(d => setSpeciesList((d as { species: string }[]).map(r => r.species)))
      .catch(() => {});
    rpc('get_mega_usage', since ? { p_since: since } : {})
      .then(d => setMegaList((d as { pokemon: string }[]).map(r => r.pokemon)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since]);

  // Main data fetch
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const p = since ? { p_since: since } : {};
        let call: RpcCall;

        if (dataset === 'teammates') {
          if (!selectedMega) { setRows([]); setLoading(false); return; }
          call = { fn: 'get_mega_teammates', params: { p_mega_item: selectedMega, ...p } };
        } else if (dataset === 'detail') {
          if (!selectedSpecies) { setRows([]); setLoading(false); return; }
          const detailFn: Record<DetailTab, string> = {
            moves:    'get_pokemon_moves',
            items:    'get_pokemon_items',
            partners: 'get_pokemon_partners',
            matchups: 'get_pokemon_matchups',
          };
          call = { fn: detailFn[detailTab], params: { p_species: selectedSpecies, p_mode: mode, ...p } };
        } else {
          const mainFn: Record<Exclude<Dataset, 'teammates' | 'detail'>, string> = {
            pokemon: 'get_pokemon_usage',
            mega:    'get_mega_usage',
            h2h:     'get_mega_h2h',
            combos:  'get_mega_combos',
          };
          call = { fn: mainFn[dataset], params: p };
        }

        const data = await rpc(call.fn, call.params);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dataset, mode, since, selectedMega, selectedSpecies, detailTab]);

  const columnDefs = useMemo<ColDef[]>(() => {
    if (dataset === 'teammates') return TEAMMATES_COLS;
    if (dataset === 'detail')    return DETAIL_COLS[detailTab];
    return [...NAME_COLS[dataset], ...MODE_COLS[dataset][mode]];
  }, [dataset, mode, detailTab]);

  const showModeToggle   = dataset !== 'teammates';
  const showMegaSelect   = dataset === 'teammates';
  const showSpeciesInput = dataset === 'detail';
  const showPlaceholder  = (showMegaSelect && !selectedMega) || (showSpeciesInput && !selectedSpecies);

  return (
    <div className="tables-container">

      {/* Date filter */}
      <div className="date-filter">
        {DATE_PRESETS.map(({ label, days }) => (
          <button
            key={label}
            className={sinceDays === days ? 'active' : ''}
            onClick={() => setSinceDays(days)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="table-header-row">
        {/* Dataset tabs */}
        <div className="dataset-toggle">
          {DATASETS.map(({ value, label }) => (
            <button
              key={value}
              className={dataset === value ? 'active' : ''}
              onClick={() => { setDataset(value); setSortParam(null); setFilterParam(null); }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Secondary controls */}
        {showModeToggle && (
          <div className="mode-toggle">
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                className={mode === value ? 'active' : ''}
                onClick={() => { setMode(value); setSortParam(null); setFilterParam(null); }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {showMegaSelect && (
          <select className="mega-select" value={selectedMega} onChange={e => setSelectedMega(e.target.value)}>
            <option value="">Select a mega...</option>
            {megaList.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        )}

        {showSpeciesInput && (
          <div className="detail-controls">
            <input
              className="species-input"
              list="species-list"
              placeholder="Search Pokemon..."
              value={selectedSpecies}
              onChange={e => setSelectedSpecies(e.target.value)}
            />
            <datalist id="species-list">
              {speciesList.map(s => <option key={s} value={s} />)}
            </datalist>
            <div className="mode-toggle">
              {DETAIL_TABS.map(({ value, label }) => (
                <button
                  key={value}
                  className={detailTab === value ? 'active' : ''}
                  onClick={() => { setDetailTab(value); setSortParam(null); setFilterParam(null); }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && <div className="table-status">Loading...</div>}
      {error   && <div className="table-status table-error">{error}</div>}
      {!loading && !error && showPlaceholder && (
        <div className="table-status">
          {showMegaSelect ? 'Select a mega item above.' : 'Search for a Pokemon above.'}
        </div>
      )}

      <div
        className="ag-theme-alpine table-grid"
        style={{ display: loading || showPlaceholder ? 'none' : undefined }}
      >
        <AgGridReact
          ref={gridRef}
          key={`${dataset}-${mode}-${detailTab}-${selectedMega}-${selectedSpecies}-${since}`}
          rowData={rows as Record<string, unknown>[]}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: false }}
          suppressCellFocus={true}
          animateRows={true}
          theme="legacy"
          onGridReady={onGridReady}
          onSortChanged={onSortChanged}
          onFilterChanged={onFilterChanged}
        />
      </div>
    </div>
  );
}
