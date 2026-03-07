# VGC Analytics Scraper

Scrapes competitive Pokemon VGC (Video Game Championships) analytics data from Limitless and RK9.gg tournaments.

## Tech Stack

- **Language**: TypeScript 5.3+
- **Database**: SQLite (`db/vgc.db`) via sql.js
- **Monorepo**: npm workspaces
- **HTTP Client**: `axios`
- **CLI**: `commander`
- **Logging**: `pino`
- **HTML Parsing**: `cheerio`

## Project Structure

```
usage-stats/
├── common/           # Shared utilities (config, api, logging)
├── cli/             # CLI tools and scrapers
│   └── src/
│       ├── cli/     # 10 CLI commands
│       ├── scrapers/
│       ├── processors/
│       └── database/
├── db/              # SQLite database
├── logs/            # Application logs
└── config.json      # Configuration
```

## Setup

```bash
npm install
npm run build
```

## Commands

```bash
# Scrape Limitless tournaments
npm run limitless -- --format gen9vgc2026regf --limit 50

# Scrape RK9 tournament
npm run rk9 -- --url "https://rk9.gg/tournament/example/"

# Process raw data
npm run process -- --source limitless

# Query database
npm run query -- --tournaments --limit 10

# Analyze teams
npm run analyze-teams
npm run find-best-duo

# Upload to pokepast.es
npm run upload -- --paste "team content"
npm run player-tournament-report <playerName>
npm run create-upload <playerId> [format]
npm run combined-paste
```

## Configuration

Copy `config.example.json` to `config.json` and add your Limitless API key:

```json
{
  "limitless": {
    "apiKey": "your_api_key_here"
  }
}
```

Or set environment variable: `export LIMITLESS_API_KEY=your_key`

## Legacy

Original Python code preserved in `python-legacy/`.
