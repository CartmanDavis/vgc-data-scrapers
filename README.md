# VGC Analytics Scraper

Scrapes competitive Pokemon VGC (Video Game Championships) analytics data from
Limitless (unofficial) and RK9.gg (official) tournaments.

## Tech Stack

- **Language**: Python 3.9+
- **Database**: SQLite (`db/vgc.db`)
- **HTTP Client**: `requests`
- **CLI**: `click`
- **Logging**: `structlog`

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
python -m scrapers.cli limitless --format gen9vgc2026regf --limit 50
```

Options:

- `--format`: Format filter (e.g., `gen9vgc2026regf`)
- `--limit`: Maximum tournaments to scrape
- `--since`: Only scrape after date (YYYY-MM-DD)
- `--api-key`: Override API key

### Scrape RK9 Tournament

```bash
python -m scrapers.rk9_cli rk9 --url "https://rk9.gg/tournament/example/"
```

Options:

- `--url`: Tournament URL (required)
- `--delay`: Request delay in seconds

### Query Database

```bash
# List tournaments
python -m database.cli query --tournaments --limit 10

# List players
python -m database.cli query --players --limit 10

# Custom SQL
python -m database.cli query --sql "SELECT * FROM tournaments WHERE official = 1"
```

### Export Data

```bash
# Export to CSV
python -m database.cli export tournaments --format csv --output tournaments.csv

# Export to JSON
python -m database.cli export players --format json --output players.json
```

### Process Raw Data (Stage 2)

```bash
python -m processors.cli process --source limitless
```

Options:

- `--source`: Data source (`limitless`, `rk9`)
- `--tournaments`: Process specific IDs (comma-separated)
- `--force`: Re-process even if already processed

## Repo Organization

```
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
   pip install -r requirements.txt
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

## More Info

- **API Details**: See `documentation/TECHNICAL_OVERVIEW.md`
- **Data Cleaning**: See `documentation/data-cleaning.md`
