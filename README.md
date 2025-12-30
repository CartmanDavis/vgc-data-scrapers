# VGC Analytics Scraper

Scrapes competitive Pokemon VGC (Video Game Championships) analytics data from Limitless (unofficial) and RK9.gg (official) tournaments.

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

## Usage

### Scrape Limitless Tournaments

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

## Database Schema

### Raw Data Table (New)

#### `limitless_api_raw_data`
Stores raw JSON responses from Limitless API for all tournaments.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Tournament ID (matches tournaments.id) |
| details | TEXT | Raw JSON from `/details` endpoint |
| standings | TEXT | Raw JSON from `/standings` endpoint |
| pairings | TEXT | Raw JSON from `/pairings` endpoint |

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

### Relationships

```
limitless_api_raw_data ───────┬───────┬───────┬───────┬───┬───────┬───────┬───────┬───────┬───────┬───────┐
                               │       │        │        │       │       │       │       │       │       │       │
                               │       │        │        │       │       │       │       │       │       │
                              ▼       ▼        ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼       │
                    (Parser)──►┴──────────────────────────────────────────────────────────────────────────────────────────────────────►
                               │
                               │
                              ▼       ▼        ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼
                               │
                  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
                  │ Parser CLI Tool (Future)
                  │
                  └─────────────────────────────────────────────────────────────────────────────────────────────┘
```

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
      "record": {"wins": 7, "losses": 0, "ties": 0},
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

## Scraper Behavior

### Limitless Scraper

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
- ❌ Parse API responses into structured tables
- ❌ Extract player information
- ❌ Extract team lists
- ❌ Extract match data
- ❌ Create tournament entries
- ❌ Apply format filtering logic (only simple string matching)

### Raw Data Storage

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

### Parser CLI Tool (Future)

A separate CLI command will:
1. Read raw data from `limitless_api_raw_data` table
2. Parse JSON responses
3. Populate traditional tables:
   - `tournaments`: Parse from details endpoint
   - `players`: Parse from standings endpoint
   - `teams`: Parse from decklists in standings
   - `pokemon_sets`: Parse from decklists in standings
   - `moves`: Parse from attacks in decklists
   - `matches`: Parse from pairings endpoint
   - `match_participants`: Parse from pairings endpoint
4. Handle duplicates, updates, and data relationships

**Benefits:**
- Decouples data fetching from data processing
- Allows re-processing without re-fetching from API
- Enables data quality checks on raw data before parsing
- Simplifies error handling (fetch vs parse errors)
- Makes the scraper faster and more reliable

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

### Install with:
```bash
pip install requests click structlog
```

## Error Handling

- Network errors: Logged and continue to next tournament
- API rate limits: Built-in respect (200 req/min default)
- Invalid responses: Logged and skipped
- Missing required fields: Logged as warnings
