# VGC Analytics Scraper

Scrapes competitive Pokemon VGC (Video Game Championships) analytics data from
Limitless (unofficial) and RK9.gg (official) tournaments.

## Tech Stack

- **Language**: TypeScript 5.3+
- **Database**: SQLite (`db/vgc.db`)
- **HTTP Client**: `axios`
- **CLI**: `commander`
- **Logging**: `pino`
- **HTML Parsing**: `cheerio`

## General Approach

This project uses a **two-stage data pipeline**:

1. **Stage 1 - Scrape**: CLI scripts hit APIs and pull raw data into SQL tables
   as-is
2. **Stage 2 - Process**: CLI script transforms raw SQL data into normalized,
   queryable tables

This separation allows:

- Idempotent scraping (no duplicate data)
- Offline analysis (raw data cached locally)
- Re-processing with schema changes

## Commands Available

### Scrape Limitless Tournaments (Stage 1)

```bash
npm run limitless -- --format gen9vgc2026regf --limit 50
```

Options:

- `--format`: Format filter (e.g., `gen9vgc2026regf`)
- `--limit`: Maximum tournaments to scrape
- `--since`: Only scrape after date (YYYY-MM-DD)
- `--api-key`: Override API key

### Scrape RK9 Tournament

```bash
npm run rk9 -- --url "https://rk9.gg/tournament/example/"
```

Options:

- `--url`: Tournament URL (required)
- `--delay`: Request delay in seconds

### Query Database

```bash
# List tournaments
npm run query -- --tournaments --limit 10

# List players
npm run query -- --players --limit 10

# Custom SQL
npm run query -- --sql "SELECT * FROM tournaments WHERE official = 1"
```

### Process Raw Data (Stage 2)

```bash
npm run process -- --source limitless
```

Options:

- `--source`: Data source (`limitless`, `rk9`)
- `--tournaments`: Process specific IDs (comma-separated)
- `--force`: Re-process even if already processed

## Repo Organization

```text
usage-stats/
├── db/                                          # SQLite database
├── logs/                                        # Application logs
├── visualizations/                              # Generated PNG outputs
├── database/                                    # Database client and CLI tools
├── scrapers/                                    # API scrapers and CLI tools
├── common/                                      # Shared utilities
├── processors/                                  # Data processors and CLI tools
├── visualization/                               # Visualization scripts
└── documentation/                               # Architecture and data docs
```

## Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure**: Copy `config.example.json` to `config.json` and add your
   Limitless API key:

   ```json
   {
     "limitless": {
       "apiKey": "your_api_key_here"
     }
   }
   ```

   Or set environment variable: `export LIMITLESS_API_KEY=your_key`

3. **Run commands**: See [Commands Available](#commands-available) above.

4. **Build**:

   ```bash
   npm run build
   ```

## More Info

- **API Details**: See `documentation/limitless.md`
- **Data Cleaning**: See `documentation/data-cleaning.md`
- **Data Overview**: See `documentation/data_overview.md`

## Migration from Python

This repository was originally written in Python and has been migrated to TypeScript. The migration maintains the same functionality while leveraging TypeScript's type safety and the rich ecosystem of Pokemon-related TypeScript libraries.

### Key Differences

- Python `requests` → TypeScript `axios`
- Python `click` → TypeScript `commander`
- Python `structlog` → TypeScript `pino`
- Python `beautifulsoup4` → TypeScript `cheerio`
- Python `sqlite3` → TypeScript `better-sqlite3`

The API and CLI commands remain the same, just using different command runners.
