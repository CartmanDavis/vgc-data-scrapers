import { useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import Papa from 'papaparse';
import pokemonUsageCsv from '../../output/pokemon_usage.csv?raw';
import megaPokemonUsageCsv from '../../output/mega_pokemon_usage.csv?raw';
import megaH2HCsv from '../../output/mega_h2h.csv?raw';
import megaCombosCsv from '../../output/mega_combos.csv?raw';
import './DataTable.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface CsvRow {
  [key: string]: string;
}

type DisplayMode = 'all' | '4plus' | 'topcut';

function parseCsv(csv: string): CsvRow[] {
  const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return result.data as CsvRow[];
}

type Dataset = 'pokemon' | 'mega' | 'h2h' | 'combos';

const DATASETS: { value: Dataset; label: string }[] = [
  { value: 'pokemon', label: 'Pokemon Usage' },
  { value: 'mega', label: 'Mega Pokemon Usage' },
  { value: 'h2h', label: 'Mega H2H' },
  // { value: 'combos', label: 'Mega Combos' },
];

const MODES: { value: DisplayMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '4plus', label: '4+ Wins' },
  { value: 'topcut', label: 'Top Cut' },
];

const DATASET_COLUMNS: Record<Dataset, { all: string[]; fourPlus: string[]; topCut: string[] }> = {
  pokemon: {
    all: ['usage_pct', 'win_rate'],
    fourPlus: ['4plus_usage_pct', '4plus_win_rate'],
    topCut: ['top_cut_usage_pct', 'top_cut_win_rate'],
  },
  mega: {
    all: ['usage_pct', 'win_rate'],
    fourPlus: ['4plus_usage_pct', '4plus_win_rate'],
    topCut: ['top_cut_usage_pct', 'top_cut_win_rate'],
  },
  h2h: {
    all: ['mega1_winrate'],
    fourPlus: ['4plus_mega1_winrate'],
    topCut: ['top_cut_mega1_winrate'],
  },
  combos: {
    all: ['usage_pct', 'win_rate'],
    fourPlus: ['4plus_usage_pct', '4plus_win_rate'],
    topCut: ['top_cut_usage_pct', 'top_cut_win_rate'],
  },
};

function formatHeader(id: string): string {
  const clean = id.replace(/top_cut/gi, '').replace(/4plus/gi, '').replace(/usage_pct/gi, 'Usage').replace(/mega1_winrate/gi, 'Win Rate').replace(/mega2_wins/gi, 'Mega 2 Wins').replace(/mega1_wins/gi, 'Mega 1 Wins').replace(/_/g, ' ').replace(/  +/g, ' ').trim();
  return clean;
}

const numberComparator = (a: any, b: any) => {
  const aVal = parseFloat(a) || 0;
  const bVal = parseFloat(b) || 0;
  return aVal - bVal;
};

const percentFormatter = (params: any) => {
  if (!params.value && params.value !== 0) return '-';
  const val = parseFloat(params.value);
  if (isNaN(val)) return params.value;
  return `${val.toFixed(1)}%`;
};

const VIEW_CONFIGS: Record<Dataset, {
  csv: string;
  nameHeader: string | ((nameCol: string) => string);
  defaultSort: { colId: string; direction: 'asc' | 'desc' }[];
  extraColumns?: { field: string; headerName: string; flex?: number; minWidth?: number; initialSort?: 'asc' | 'desc'; sortIndex?: number }[];
}> = {
  pokemon: {
    csv: pokemonUsageCsv,
    nameHeader: 'Pokemon',
    defaultSort: [{ colId: 'usage_pct', direction: 'desc' }],
  },
  mega: {
    csv: megaPokemonUsageCsv,
    nameHeader: (nameCol: string) => formatHeader(nameCol),
    defaultSort: [{ colId: 'usage_pct', direction: 'desc' }],
  },
  h2h: {
    csv: megaH2HCsv,
    nameHeader: 'Pokemon',
    defaultSort: [
      { colId: 'Mega 1', direction: 'asc' },
      { colId: 'Mega 2', direction: 'asc' },
    ],
    extraColumns: [
      { field: 'Mega 1', headerName: 'Mega', flex: 2, minWidth: 80, initialSort: 'asc', sortIndex: 0 },
      { field: 'Mega 2', headerName: 'Opponent', flex: 2, minWidth: 80, initialSort: 'asc', sortIndex: 1 },
    ],
  },
  combos: {
    csv: megaCombosCsv,
    nameHeader: (nameCol: string) => formatHeader(nameCol),
    defaultSort: [{ colId: 'usage_pct', direction: 'desc' }],
  },
};

export function DataTable() {
  const [dataset, setDataset] = useState<Dataset>('pokemon');
  const [mode, setMode] = useState<DisplayMode>('all');

  const rawData = useMemo(() => parseCsv(VIEW_CONFIGS[dataset].csv), [dataset]);

  const allColumnIds = useMemo(() => Object.keys(rawData[0] || {}), [rawData]);
  const nameColumn = allColumnIds[0];

  const modeColumns = useMemo(() => {
    switch (mode) {
      case 'all': return DATASET_COLUMNS[dataset].all;
      case '4plus': return DATASET_COLUMNS[dataset].fourPlus;
      case 'topcut': return DATASET_COLUMNS[dataset].topCut;
    }
  }, [mode, dataset]);

  const config = VIEW_CONFIGS[dataset];
  const nameHeader = typeof config.nameHeader === 'function'
    ? config.nameHeader(nameColumn)
    : config.nameHeader;

  const visibleColumns = useMemo(() => {
    const cols: {
      field: string;
      headerName: string;
      sortable: boolean;
      filter: boolean;
      resizable: boolean;
      cellClass?: string;
      valueFormatter?: (params: any) => string;
      flex?: number;
      initialSort?: 'asc' | 'desc';
      comparator?: (a: any, b: any) => number;
      minWidth?: number;
      sortIndex?: number;
    }[] = [];

    if (config.extraColumns) {
      for (const extraCol of config.extraColumns) {
        cols.push({
          field: extraCol.field,
          headerName: extraCol.headerName,
          sortable: true,
          filter: true,
          resizable: false,
          cellClass: 'string-cell',
          flex: extraCol.flex,
          minWidth: extraCol.minWidth,
          initialSort: extraCol.initialSort,
          sortIndex: extraCol.sortIndex,
        });
      }
    } else {
      cols.push({
        field: nameColumn,
        headerName: nameHeader,
        sortable: true,
        filter: true,
        resizable: false,
        cellClass: 'string-cell',
        flex: 1,
        sortIndex: 0,
      });
    }

    const skipSortIndex = dataset === 'h2h';
    modeColumns.forEach((id, i) => {
      cols.push({
        field: id,
        headerName: formatHeader(id),
        sortable: true,
        filter: true,
        resizable: false,
        flex: 1,
        initialSort: skipSortIndex ? undefined : (i === 0 ? config.defaultSort[0].direction : undefined),
        sortIndex: skipSortIndex ? undefined : (i === 0 ? config.defaultSort.length : undefined),
        comparator: numberComparator,
        valueFormatter: percentFormatter,
      });
    });

    return cols;
  }, [nameColumn, nameHeader, modeColumns, config]);

  const defaultColDef = {
    sortable: true,
    filter: true,
    resizable: false,
  };

  return (
    <div className="tables-container">
      <div className="table-header-row">
        <div className="dataset-toggle">
          {DATASETS.map(({ value, label }) => (
            <button
              key={value}
              className={dataset === value ? 'active' : ''}
              onClick={() => setDataset(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mode-toggle">
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              className={mode === value ? 'active' : ''}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ag-theme-alpine table-grid">
        <AgGridReact
          key={`${dataset}-${mode}`}
          rowData={rawData}
          columnDefs={visibleColumns}
          defaultColDef={defaultColDef}
          pagination={false}
          suppressCellFocus={true}
          animateRows={true}
          theme="legacy"
          initialState={{
            sort: { sortModel: config.defaultSort.map(s => ({ colId: s.colId, sort: s.direction })) },
          }}
        />
      </div>
    </div>
  );
}
