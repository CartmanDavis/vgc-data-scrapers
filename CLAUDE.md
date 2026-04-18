# VGC Usage Stats

Competitive Pokemon VGC analytics platform. Scrapes tournament data from Limitless TCG and RK9.gg, stores it in SQLite, and surfaces usage/win rate stats via a React frontend.

## Workspace structure

Pnpm monorepo with three packages and a shared SQLite database:

```
common/     Shared library: DB wrapper, scrapers, processor, API client
cli/        Node.js scripts for scraping, processing, and querying data
frontend/   React + Vite SPA that reads the DB in-browser via sql.js
db/vgc.db   The SQLite database (not in version control)
config.json Limitless API key and other runtime config (not in version control)
output/     Generated CSV reports
docs/data/  Query documentation and data notes
```

## Build & test

```bash
pnpm build          # tsc --build (compiles all three packages)
pnpm test           # vitest run (runs common/ and frontend/ tests)
pnpm clean          # tsc --build --clean
```

Always build before running CLI commands — scripts run from `cli/dist/`.

## Config

`config.json` at the repo root (gitignored):

```json
{
  "limitless": {
    "apiKey": "<key>",
    "baseUrl": "https://play.limitlesstcg.com/api",
    "rateLimit": 200
  }
}
```

The API key can also be set via the `LIMITLESS_API_KEY` environment variable.

## Data pipeline

```
Limitless API → limitless scraper → limitless_api_raw_data table
                                              ↓
                                         processor → normalized tables
                                                          ↓
                                                    query / frontend
```

### Step 1 — Scrape

```bash
# Scrape all M-A (Mega format) tournaments
pnpm --filter @vgc/cli run limitless --format M-A

# Scrape with a date cutoff (skips older tournaments)
pnpm --filter @vgc/cli run limitless --format M-A --since 2026-04-01

# Scrape a single tournament by its Limitless ID
pnpm --filter @vgc/cli run limitless --id <tournament-id>

# Scrape Regulation F (two equivalent forms)
pnpm --filter @vgc/cli run limitless --format SVF
```

Raw JSON (details + standings + pairings) is stored in `limitless_api_raw_data`. Already-scraped tournaments are skipped automatically.

### Step 2 — Process

```bash
# Process all unprocessed raw data
pnpm --filter @vgc/cli run process

# Re-process specific tournaments (e.g. after a schema change)
pnpm --filter @vgc/cli run process --tournaments id1,id2 --force
```

The processor reads `limitless_api_raw_data`, skips non-VGC games, and populates the normalized tables. Check the result JSON for `tournamentsProcessed` and `errors`.

## Querying the database

```bash
# Quick inspection shortcuts
pnpm --filter @vgc/cli run query --tournaments          # recent tournaments
pnpm --filter @vgc/cli run query --players              # players list
pnpm --filter @vgc/cli run query --teams                # teams list
pnpm --filter @vgc/cli run query --limit 50 --sql "SELECT ..."
```

For ad-hoc analysis, use the `query` script with `--sql`. The DB is at `db/vgc.db` and can also be opened directly with any SQLite client.

### Writing queries directly

The `common/src/database/db.ts` `DB` class wraps sql.js. Usage from a script:

```typescript
const db = new DB();
await db.init();
const rows = db.prepare('SELECT ...').all(param1, param2);
db.close(); // saves db to disk
```

For quick one-off scripts without TypeScript overhead, use `better-sqlite3` directly (already installed):

```javascript
import Database from '.../node_modules/.pnpm/better-sqlite3@11.10.0/.../lib/index.js';
const db = new Database('db/vgc.db', { readonly: true });
```

## Database schema

| Table | Key columns |
|-------|-------------|
| `tournaments` | `id, name, date, format, generation, official` |
| `players` | `id, name, country` |
| `teams` | `id, player_id, tournament_id` — one row per player per tournament |
| `pokemon_sets` | `id, team_id, species, form, item, ability, tera_type` |
| `moves` | `id, pokemon_set_id, move_name` |
| `matches` | `id, tournament_id, round_number, table_number, phase` |
| `match_participants` | `id, match_id, player_id, team_id, score` — two rows per match |
| `tournament_standings` | `tournament_id, player_id, team_id, placing, wins, losses, ties, dropped` |
| `limitless_api_raw_data` | `id, details, standings, pairings` — raw JSON from scraper |

**Important subtleties:**
- `match_participants` has two rows per match (one per player); always join both sides to get opponent
- `teams` is keyed on `(player_id, tournament_id)` — a player who attends 5 tournaments has 5 team rows, even if the team is identical
- Win rate = `SUM(score) / COUNT(*)` over `match_participants` (score is 1 for win, 0 for loss)
- Mega item usage % is computed against **mega teams** as the denominator, not all teams

## Known formats

| Format code | Description |
|-------------|-------------|
| `M-A` | Mega format (custom, 2026) — the main focus of current analysis |
| `SVF` | Regulation F (Scarlet/Violet Gen 9 standard) |
| `SVE`, `SVG`, `SVH`, `SVI` | Other Regulation seasons |
| `VGC23` | Custom Gen 9 format — minimal mega item data |
| `CUSTOM` | Miscellaneous custom formats |

## Output CSVs

Generated by ad-hoc scripts and stored in `output/`. For M-A format:

| File | What it measures |
|------|-----------------|
| `pokemon_usage.csv` | Species usage across all M-A teams; 4+ wins subset |
| `mega_pokemon_usage.csv` | Canonical mega stone usage per distinct team; 4+ wins subset |
| `mega_h2h.csv` | Head-to-head win rates between mega types (≥20 matches) |
| `mega_combos.csv` | Mega stone combos brought on same team (≥10 teams) |

**Canonical mega items** are the known `*ite` item names listed in `docs/data/mega-pokemon-queries.md`. Usage % for these is relative to total mega teams (teams with at least one canonical item), not total M-A teams.

**Combo detection** uses a broader `LIKE '%ite%'` pattern (excluding `Eviolite`, `No Item`, `White Herb`), so combo totals may differ slightly from canonical counts.

Regenerate all four CSVs with:

```javascript
// regenerate-csvs.mjs — ad-hoc Node.js script (not committed)
import Database from '.../better-sqlite3/.../lib/index.js';
// ... build itemMap, teamScoresMap, etc. then write to output/
```

## Other CLI scripts

```bash
# Partner analysis for a specific duo (currently hardcoded to SVF + Chien-Pao/Dragonite)
pnpm --filter @vgc/cli run analyze-teams

# Top Pokemon pairs by win rate (SVF)
pnpm --filter @vgc/cli run find-best-duo

# Generate a Pokepaste + match report for a player (uploads to pokepast.es)
pnpm --filter @vgc/cli run player-tournament-report "Player Name" --days 90

# Create a combined paste for a player's teams across SVF tournaments
pnpm --filter @vgc/cli run combined-paste <player-id>
```

## Frontend

React + Vite SPA using sql.js to run SQLite queries in the browser.

```bash
pnpm --filter @vgc/frontend run dev     # start dev server
pnpm --filter @vgc/frontend run build   # production build to frontend/dist/
```

The frontend fetches `db/vgc.db` at `/db/vgc.db` on startup. For local dev, Vite must be able to serve the file — place `db/vgc.db` in `frontend/public/db/` or configure the Vite dev server proxy. Pages: tournament list, tournament detail, usage stats, player profile, team analysis.

## Data quality notes

See `docs/data/data-cleaning.md` for a full log of manual cleaning done on species names, item names, ability names, and move names. Key things to know:

- Item and ability names have case variants in the raw data — always use `LOWER()` for comparisons
- Some teams contain format-illegal Pokemon (scraped as-is, not filtered)
- The same Mega item may appear under different capitalizations (`floettite` vs `Floettite`) — the canonical list in `docs/data/mega-pokemon-queries.md` normalizes these
- `Eviolite` ends in `ite` but is not a Mega stone — always exclude it from Mega queries
