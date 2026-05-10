# VGC Usage Stats

Competitive Pokemon VGC analytics platform. Scrapes tournament data from Limitless TCG and RK9.gg, stores it in Supabase (PostgreSQL), and surfaces usage/win rate stats via generated CSV reports.

## Workspace structure

Pnpm monorepo with two packages:

```
common/     Shared library: scrapers, processor, validator, API client, config
cli/        Node.js scripts for scraping, processing, and querying data
  src/db/   Data store implementations (SupabaseDataStore, legacy SQLite DB)
config.json Limitless API key, Supabase credentials (not in version control)
output/     Generated CSV reports
docs/data/  Query documentation and data notes
supabase/   PostgreSQL schema and migration files
```

## Build & test

```bash
pnpm build          # tsc --build (compiles both packages)
pnpm test           # vitest run (runs common/ tests)
pnpm clean          # tsc --build --clean
```

Always build before running CLI commands — scripts run from `cli/dist/`.

## Config

`config.json` at the repo root (gitignored). Copy `config.example.json` to get started:

```json
{
  "limitless": {
    "apiKey": "<key>",
    "baseUrl": "https://play.limitlesstcg.com/api",
    "rateLimit": 200
  },
  "supabase": {
    "url": "<project-url>",
    "anonKey": "<anon-key>",
    "serviceRoleKey": "<service-role-key>"
  }
}
```

Env var overrides: `LIMITLESS_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Data pipeline

```
Limitless API → limitless scraper → limitless_api_raw_data (Supabase)
                                              ↓
                                         processor → normalized tables (Supabase)
                                                          ↓
                                                    generate-csvs → output/
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

Raw JSON (details + standings + pairings) is stored in `limitless_api_raw_data` in Supabase. Already-scraped tournaments are skipped automatically.

### Step 2 — Process

```bash
# Process all unprocessed raw data
pnpm --filter @vgc/cli run process

# Re-process specific tournaments (e.g. after a schema change)
pnpm --filter @vgc/cli run process --tournaments id1,id2 --force
```

The processor reads `limitless_api_raw_data`, skips non-VGC games, and populates the normalized tables. Check the result JSON for `tournamentsProcessed` and `errors`.

## Querying the database

Ad-hoc queries are best run directly in the Supabase SQL editor (Database → SQL Editor). The schema is in `supabase/schema.sql`.

For script-level queries, use `SupabaseDataStore` from `cli/src/db/supabase-db.ts`, or call the Supabase JS client directly:

```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const { data } = await supabase.from('tournaments').select('*').eq('format', 'M-A');
```

The `query` CLI script (`pnpm --filter @vgc/cli run query`) still exists but reads from a local SQLite file — it's a legacy holdover and not useful for Supabase data.

## Database schema

| Table | Key columns |
|-------|-------------|
| `tournaments` | `id, name, date, format, generation, official` |
| `players` | `id, name, country` |
| `teams` | `id, player_id, tournament_id` — one row per player per tournament |
| `pokemon_sets` | `id, team_id, species, form, item, ability, tera_type, is_mega, invalid` |
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

Generated by `pnpm --filter @vgc/cli run generate-csvs` and stored in `output/`. For M-A format:

| File | What it measures |
|------|-----------------|
| `pokemon_usage.csv` | Species usage across all M-A teams; 4+ wins subset |
| `mega_pokemon_usage.csv` | Canonical mega stone usage per distinct team; 4+ wins subset |
| `mega_h2h.csv` | Head-to-head win rates between mega types (≥20 matches) |
| `mega_combos.csv` | Mega stone combos brought on same team (≥10 teams) |

**Canonical mega items** are the known `*ite` item names listed in `docs/data/mega-pokemon-queries.md`. Usage % for these is relative to total mega teams (teams with at least one canonical item), not total M-A teams.

**Combo detection** uses a broader `LIKE '%ite%'` pattern (excluding `Eviolite`, `No Item`, `White Herb`), so combo totals may differ slightly from canonical counts.

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

## Data quality notes

See `docs/data/data-cleaning.md` for a full log of manual cleaning done on species names, item names, ability names, and move names. Key things to know:

- Item and ability names have case variants in the raw data — always use `LOWER()` for comparisons
- Some teams contain format-illegal Pokemon (scraped as-is, not filtered)
- The same Mega item may appear under different capitalizations (`floettite` vs `Floettite`) — the canonical list in `docs/data/mega-pokemon-queries.md` normalizes these
- `Eviolite` ends in `ite` but is not a Mega stone — always exclude it from Mega queries
