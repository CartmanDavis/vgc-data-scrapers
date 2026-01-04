# VGC Analytics Scraper

Scrapes competitive Pokemon VGC (Video Game Championships) analytics data from Limitless (unofficial) and RK9.gg (official) tournaments.

**Data Pipeline:**

1. **Stage 1 - Scrape**: CLI scripts hit APIs and pull raw data into SQL
2. **Stage 2 - Process**: CLI script transforms raw SQL data into queryable tables

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Create a `config.json` file in the project root:

```json
{
  "limitless": {
    "apiKey": "your_api_key_here",
    "baseUrl": "https://api.limitlesstcg.com",
    "rateLimit": 200
  },
  "rk9": {
    "baseUrl": "https://rk9.gg",
    "requestDelay": 1.0
  },
  "database": {
    "path": "./db/vgc.db"
  },
  "log": {
    "dir": "./logs"
  }
}
```

Or use environment variables:

```bash
export LIMITLESS_API_KEY=your_api_key_here
```

## Data Pipeline

This project uses a **two-stage data pipeline**:

### Stage 1: Scrape Raw Data

CLI scripts hit external APIs and pull raw data into SQL tables. The raw data is stored exactly as received from the API, preserving all information for flexible processing.

**Example:** Query Limitless API for all tournaments matching a format, store raw API responses (details, standings, pairings) for each tournament in the `limitless_api_raw_data` table.

### Stage 2: Process Raw Data

A CLI script transforms raw SQL data into more useful, queryable tables. This stage parses JSON responses and populates normalized tables for analysis.

**Example:** Transform raw tournament data from `limitless_api_raw_data` into structured tables:

- `tournaments` - tournament metadata
- `players` - player information
- `teams` - team compositions
- `pokemon_sets` - individual Pokemon builds
- `matches` - match results

## Usage

### Scrape Limitless Tournaments (Stage 1)

**Important**: The Limitless scraper now operates in **raw-data-only mode**. It fetches and stores raw API responses without parsing them into other tables.

```bash
python main.py limitless --format gen9vgc2026regf --limit 50
```

Options:

- `--format`: Format filter (e.g., gen9vgc2026regf)
- `--limit`: Maximum number of tournaments to scrape
- `--since`: Only scrape tournaments after this date (YYYY-MM-DD format)
- `--api-key`: Override API key

**What happens:**

1. Scraper fetches tournaments from `/tournaments` endpoint
2. For each tournament, it checks if raw data already exists
3. If not exists, it fetches 3 endpoints: `/details`, `/standings`, `/pairings`
4. All raw responses are stored in `limitless_api_raw_data` table
5. **No parsing** occurs - data is stored as raw JSON

Example: Scrape only new tournaments since last run

```bash
python main.py limitless --format gen9vgc2026regf --since 2025-12-01
```

### Scrape RK9 Tournament

```bash
python main.py rk9 --url "https://rk9.gg/tournament/example/"
```

Options:

- `--url`: RK9 tournament URL (required)
- `--delay`: Request delay in seconds

### Query Database

```bash
# List tournaments
python main.py query --tournaments --limit 10

# List players
python main.py query --players --limit 10

# Custom SQL query
python main.py query --sql "SELECT * FROM tournaments WHERE official = 1"
```

### Export Data

```bash
# Export to CSV
python main.py export tournaments --format csv --output tournaments.csv

# Export to JSON
python main.py export players --format json --output players.json
```

### Process Raw Data into Structured Tables (Stage 2)

```bash
python main.py process --source limitless
```

This command reads raw data from `limitless_api_raw_data` and populates:

- `tournaments` table
- `players` table
- `teams` table
- `pokemon_sets` table
- `moves` table
- `matches` table
- `match_participants` table

Options:

- `--source`: Data source to process (limitless, rk9)
- `--tournaments`: Process only specific tournament IDs (comma-separated)
- `--force`: Re-process tournaments even if already processed

**What happens:**
1. Reads raw JSON from `limitless_api_raw_data` table
2. Parses `details` endpoint into `tournaments` table
3. Parses `standings` endpoint into `players`, `teams`, `pokemon_sets`, `moves` tables
4. Parses `pairings` endpoint into `matches`, `match_participants` tables
5. Handles duplicates and updates existing records

**Example:** Process a specific tournament
```bash
python main.py process --source limitless --tournaments 69466de1ba66621ba08a47b7
```

## Database Schema

### Raw Data Table (New)

#### `limitless_api_raw_data`

Stores raw JSON responses from Limitless API for all tournaments.

| Column    | Type      | Description                            |
| --------- | --------- | -------------------------------------- |
| id        | TEXT (PK) | Tournament ID (matches tournaments.id) |
| details   | TEXT      | Raw JSON from `/details` endpoint      |
| standings | TEXT      | Raw JSON from `/standings` endpoint    |
| pairings  | TEXT      | Raw JSON from `/pairings` endpoint     |

**Requirements:**

- All 3 columns (`details`, `standings`, `pairings`) are required for a complete tournament record
- UNIQUE(id) constraint ensures one row per tournament
- FK relationship to tournaments table for referential integrity

**Purpose:**
This table is the **sole source of truth** for Limitless tournament data. All parsing, processing, and analysis should read from this table.

### Traditional Tables (Not Populated by Scraper)

The following tables exist for backward compatibility and will be populated by a separate CLI tool:

#### `tournaments`

Tournament information (will be populated by separate parser from raw data)

#### `players`

Player information (will be populated by separate parser from raw data)

#### `teams`

Team lists used in tournaments (will be populated by separate parser from raw data)

#### `pokemon_sets`

Individual Pokemon sets (will be populated by separate parser from raw data)

#### `matches`

Match information (will be populated by separate parser from raw data)

#### `match_participants`

Players/teams participating in matches and their scores (will be populated by separate parser from raw data)

## Data Source Details

### Limitless API (Unofficial)

**Base URL**: `https://api.limitlesstcg.com`
**Authentication**: Header `X-Access-Key: <your_api_key>`
**Rate Limit**: 200 requests/minute

**Endpoints Used:**

#### Get Tournaments

```
GET /tournaments?format={format}&page={page}
```

**Response Shape:**

```json
{
  "data": [
    {
      "id": "t-abc123",
      "name": "VGC 2026 Reg F - Austin",
      "date": "2025-03-15",
      "location": "Austin, TX",
      "format": "gen9vgc2026regf",
      "playerCount": 127
    }
  ]
}
```

#### Get Tournament Details

```
GET /tournaments/{id}/details
```

**Response Shape:**

```json
{
  "data": {
    "id": "t-abc123",
    "name": "VGC 2026 Reg F - Austin",
    "date": "2025-03-15",
    "location": "Austin, TX",
    "format": "gen9vgc2026regf",
    "playerCount": 127,
    "phases": [
      {
        "phase": 1,
        "type": "SWISS",
        "rounds": 5,
        "mode": "BO3"
      },
      {
        "phase": 2,
        "type": "SINGLE_BRACKET",
        "rounds": 1,
        "mode": "BO3"
      }
    ]
  }
}
```

#### Get Tournament Standings

```
GET /tournaments/{id}/standings
```

**Response Shape:**

```json
{
  "data": [
    {
      "player": "p-xyz789",
      "name": "John Doe",
      "country": "USA",
      "placing": 1,
      "record": { "wins": 7, "losses": 0, "ties": 0 },
      "decklist": [
        {
          "id": "raging-bolt",
          "name": "Raging Bolt",
          "item": "Booster Energy",
          "ability": "Protosynthesis",
          "tera": "Fairy",
          "attacks": ["Thunderclap", "Dragon Pulse", "Calm Mind", "Protect"]
        }
      ]
    }
  ]
}
```

#### Get Tournament Pairings

```
GET /tournaments/{id}/pairings
```

**Response Shape:**

```json
{
  "data": [
    {
      "round": 1,
      "phase": 1,
      "table": 1,
      "player1": "p-abc123",
      "player2": "p-def456",
      "winner": "p-abc123",
      "match": "T1-1"
    }
  ]
}
```

### RK9.gg Tournament Scraper (Official)

**Base URL**: `https://rk9.gg`
**Pages to Scrape:**

1. **Tournament Page**: General tournament info (name, date)
2. **Roster Page**: Player list with team lists
3. **Pairings Page**: Round-by-round matchups

**Example URLs:**

```
Tournament: https://rk9.gg/tournament/xyz/
Roster: https://rk9.gg/tournament/xyz/roster/
Pairings: https://rk9.gg/tournament/xyz/pairings/
```

## Data Points

- Tournament name, date, location
- Player names, countries
- Team lists: species, form, item, ability, tera_type
- Match results: round, table, player IDs, scores

## Pipeline Details

### Stage 1: Scraper (Fetch Raw Data)

The scrapers are responsible ONLY for fetching data from external APIs and storing it in raw form.

**Limitless Scraper:**

**Data Flow:**

1. Fetches tournament list with pagination
2. For each tournament:
   - Checks if raw data exists (to avoid re-fetching)
   - Fetches 3 endpoints: `/details`, `/standings`, `/pairings`
   - Stores raw JSON in `limitless_api_raw_data` table
3. **No parsing** - All processing will be done by separate tool

**What the Scraper Does:**

- ✅ Fetches raw API data
- ✅ Stores complete JSON responses
- ❌ Does NOT populate tournaments, players, teams, matches, pokemon_sets, moves, match_participants
- ✅ Respects rate limits (200 req/min)
- ✅ Handles errors gracefully (continues to next tournament)
- ✅ Logs progress and errors

**What the Scraper Does NOT Do:**

- ❌ Parse API responses into structured tables (handled by Stage 2)
- ❌ Extract player information (handled by Stage 2)
- ❌ Extract team lists (handled by Stage 2)
- ❌ Extract match data (handled by Stage 2)
- ❌ Create tournament entries (handled by Stage 2)
- ❌ Apply format filtering logic (only simple string matching)

### Stage 2: Processor (Transform Raw Data)

The processor reads raw JSON from SQL tables and transforms it into structured tables.

**What the Processor Does:**

- ✅ Parses JSON from `limitless_api_raw_data` table
- ✅ Populates `tournaments`, `players`, `teams`, `pokemon_sets`, `matches` tables
- ✅ Handles data relationships and foreign keys
- ✅ Supports incremental updates and re-processing
- ✅ Validates data integrity before insertion

**Benefits:**

- **Decouples fetching from processing**: Separate concerns make each stage simpler
- **Idempotent processing**: Can re-run to apply schema changes or fix bugs
- **No API dependency for analysis**: Work offline with cached raw data
- **Data quality checks**: Validate raw data before parsing
- **Incremental updates**: Process only new or changed tournaments

### Raw Data Storage (Stage 1 Output)

The `limitless_api_raw_data` table contains:

- **id**: Tournament ID (same as tournaments.id)
- **details**: Complete JSON from `/details` endpoint (includes phases structure)
- **standings**: Complete JSON from `/standings` endpoint (includes player placements, records, decklists)
- **pairings**: Complete JSON from `/pairings` endpoint (includes all match data)

**Validation:**

```sql
-- Check all 3 columns are populated
SELECT
    id,
    CASE WHEN details IS NOT NULL THEN 1 ELSE 0 END as has_details,
    CASE WHEN standings IS NOT NULL THEN 1 ELSE 0 END as has_standings,
    CASE WHEN pairings IS NOT NULL THEN 1 ELSE 0 END as has_pairings,
    CASE
        WHEN details IS NOT NULL
            AND standings IS NOT NULL
            AND pairings IS NOT NULL
        THEN 1 ELSE 0
    END as all_complete
FROM limitless_api_raw_data;
```

## Project Structure

```
vgc-scraper/
├── db/
│   └── vgc.db                    # SQLite database
├── scrapers/
│   ├── base.py                   # Base scraper interface
│   ├── limitless.py              # Limitless API integration (RAW DATA ONLY)
│   └── rk9.py                    # RK9 HTML scraper
├── models/
│   ├── tournament.py             # Tournament model
│   ├── player.py                 # Player model
│   ├── team.py                   # Team model
│   └── pokemon_set.py            # Pokemon set model
├── utils/
│   ├── db.py                     # Database connection and queries
│   ├── api.py                    # HTTP client helpers
│   ├── logging.py                # Logging configuration
│   └── config.py                 # Configuration management
├── main.py                       # CLI entry point
├── logs/                         # Log files
├── requirements.txt
└── README.md
```

## Example CLI Output

```
$ python main.py limitless --format gen9vgc2026regf --limit 5

[2025-03-15 10:00:00] Starting Limitless scraper...
[2025-03-15 10:00:01] Found 127 tournaments matching criteria
[2025-03-15 10:00:05] Scraping tournament: t-abc123
[2025-03-15 10:00:06] Raw data stored: details ✓
[2025-03-15 10:00:07] Raw data stored: standings ✓
[2025-03-15 10:00:08] Raw data stored: pairings ✓
[2025-03-15 10:00:09] Scraping tournament: t-def456
...
[2025-03-15 10:01:00] ✓ Complete: 5 tournaments, 15 raw responses
```

## Notes

- The scraper now operates in a **pipeline-friendly** manner: fetch raw data, process later
- The `limitless_api_raw_data` table is the authoritative source for Limitless tournament data
- All future analysis, queries, and visualizations should work with this raw data table
- The `tournaments` table exists in the schema but is NOT populated by the scraper (it will be populated by the parser tool)
- Rate limiting is built-in to avoid API blocks
- Scraper is idempotent: checks for existing data before fetching

## Dependencies

### Python

- Database: `sqlite3` (built-in)
- HTTP Client: `requests` or `httpx`
- CLI: `click`
- Logging: `structlog` or `logging` (built-in)

### Install with

```bash
pip install requests click structlog
```

## Error Handling

- Network errors: Logged and continue to next tournament
- API rate limits: Built-in respect (200 req/min default)
- Invalid responses: Logged and skipped
- Missing required fields: Logged as warnings
