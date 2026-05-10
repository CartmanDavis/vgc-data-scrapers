# VGC Analytics Scraper

Scrapes competitive Pokemon VGC (Video Game Championships) analytics data from Limitless and RK9.gg tournaments, stores it in Supabase (PostgreSQL), and generates usage/win rate CSV reports.

## Tech Stack

- **Language**: TypeScript 5.3+
- **Database**: Supabase (PostgreSQL)
- **Monorepo**: pnpm workspaces
- **HTTP Client**: `axios`
- **CLI**: `commander`
- **Logging**: `pino`
- **HTML Parsing**: `cheerio`

## Project Structure

```
usage-stats/
├── common/           # Shared utilities (config, api, logging, scrapers, processor)
├── cli/              # CLI tools and scrapers
│   └── src/
│       ├── db/       # SupabaseDataStore + legacy SQLite DB
│       └── *.ts      # CLI scripts
├── supabase/         # PostgreSQL schema and migrations
├── output/           # Generated CSV reports
├── logs/             # Application logs
└── config.json       # Configuration (gitignored — copy from config.example.json)
```

## Setup

```bash
pnpm install
pnpm build
```

Copy `config.example.json` to `config.json` and fill in your credentials:

```json
{
  "limitless": {
    "apiKey": "your_api_key_here"
  },
  "supabase": {
    "url": "<project-url>",
    "anonKey": "<anon-key>",
    "serviceRoleKey": "<service-role-key>"
  }
}
```

Env var overrides: `LIMITLESS_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Commands

```bash
# Scrape Limitless tournaments
pnpm --filter @vgc/cli run limitless -- --format M-A
pnpm --filter @vgc/cli run limitless -- --id <tournament-id>

# Scrape RK9 tournament
pnpm --filter @vgc/cli run rk9 -- --url "https://rk9.gg/tournament/example/"

# Process raw data into normalized tables
pnpm --filter @vgc/cli run process

# Generate CSV reports (output/)
pnpm --filter @vgc/cli run generate-csvs

# Analyze teams
pnpm --filter @vgc/cli run analyze-teams
pnpm --filter @vgc/cli run find-best-duo

# Upload to pokepast.es
pnpm --filter @vgc/cli run player-tournament-report "Player Name"
pnpm --filter @vgc/cli run combined-paste <player-id>
```
