# VGC Analytics Scraper - Technical Overview

## Architecture Overview

This project scrapes competitive Pokemon VGC (Video Game Championships) analytics data from two sources:
1. **Limitless API** (limitlesstcg.com) - Grassroots tournaments (unofficial)
2. **RK9.gg** - Official tournament results via HTML scraping (manual URL input)

All data is stored in a SQLite database (`db/vgc.db`) and can be queried, exported, or displayed via a simple HTTP API.

```
┌─────────────┐     ┌─────────────┐
│  Limitless  │     │    RK9.gg   │
│     API     │     │   Scraper   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Database  │
                    │   (SQLite)  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  CLI / API  │
                    └─────────────┘
```

## Project Structure

```
vgc-scraper/
├── db/
│   └── vgc.db                    # SQLite database
├── scrapers/
│   ├── base.py                   # Base scraper interface
│   ├── limitless.py              # Limitless API integration
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

## Database Schema

### Tables

#### `tournaments`
Stores tournament information from all sources.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Unique identifier |
| name | TEXT | Tournament name |
| date | DATETIME | Tournament date |
| location | TEXT | Tournament location |
| generation | INTEGER | Generation number (e.g., 9) |
| format | TEXT | Format name (e.g., "reg f") |
| official | BOOLEAN | True = RK9, False = Limitless |

#### `players`
Stores player information, deduplicated across sources.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-generated ID |
| name | TEXT | Player name |
| country | TEXT | Player country code |

#### `teams`
Stores team lists used in tournaments.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-generated ID |
| player_id | INTEGER (FK) | FK to players.id |
| tournament_id | TEXT (FK) | FK to tournaments.id |

#### `pokemon_sets`
Stores individual Pokemon sets with OTS (Open Team Sheet) data.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-generated |
| team_id | INTEGER (FK) | FK to teams.id |
| species | TEXT | Pokemon species name |
| form | TEXT | Form variant (optional) |
| item | TEXT | Held item |
| ability | TEXT | Pokemon ability |
| tera_type | TEXT | Tera type |

#### `moves`
Stores moves for each Pokemon set.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-generated |
| pokemon_set_id | INTEGER (FK) | FK to pokemon_sets.id |
| move_name | TEXT | Move name |

#### `matches`
Stores match information (round, table).

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-generated |
| tournament_id | TEXT (FK) | FK to tournaments.id |
| round_number | INTEGER | Round number |
| table_number | INTEGER | Table number |

#### `match_participants`
Stores players/teams participating in matches and their scores.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-generated |
| match_id | INTEGER (FK) | FK to matches.id |
| player_id | INTEGER (FK) | FK to players.id |
| team_id | INTEGER (FK) | FK to teams.id |
| score | INTEGER | Games won (0, 1, 2, etc.) |

### Future Enhancement: `pokemon_set_details` (CTS Data)

This table will be added in the future for Closed Team Sheet data from Showdown.

| Column | Type | Description |
|--------|------|-------------|
| pokemon_set_id | INTEGER (PK, FK) | FK to pokemon_sets.id |
| nature | TEXT | Nature (e.g., "Timid", "Bold") |
| ev_hp | INTEGER | HP EVs (0-252) |
| ev_atk | INTEGER | Attack EVs (0-252) |
| ev_def | INTEGER | Defense EVs (0-252) |
| ev_spa | INTEGER | Sp. Attack EVs (0-252) |
| ev_spd | INTEGER | Sp. Defense EVs (0-252) |
| ev_spe | INTEGER | Speed EVs (0-252) |
| iv_hp | INTEGER | HP IVs (0-31) |
| iv_atk | INTEGER | Attack IVs (0-31) |
| iv_def | INTEGER | Defense IVs (0-31) |
| iv_spa | INTEGER | Sp. Attack IVs (0-31) |
| iv_spd | INTEGER | Sp. Defense IVs (0-31) |
| iv_spe | INTEGER | Speed IVs (0-31) |

### Relationships

```
tournaments → teams → pokemon_sets → moves

tournaments → matches → match_participants → players
                              ↓
                              teams
```

## Data Source Details

### 1. Limitless API (Unofficial)

**Base URL**: `https://api.limitlesstcg.com`

**Authentication**:
- Header: `X-Access-Key: <your_api_key>`
- Rate limit: 200 requests/minute

**Endpoints**:

#### Get Tournaments
```
GET /tournaments?playerId={playerId}&format={format}
```

**Response Shape**:
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

**Response Shape**:
```json
{
  "data": {
    "id": "t-abc123",
    "name": "VGC 2026 Reg F - Austin",
    "date": "2025-03-15",
    "location": "Austin, TX",
    "format": "gen9vgc2026regf",
    "playerCount": 127
  }
}
```

#### Get Tournament Standings
```
GET /tournaments/{id}/standings
```

**Response Shape**:
```json
{
  "data": [
    {
      "playerId": "p-xyz789",
      "name": "John Doe",
      "country": "USA",
      "rank": 1,
      "record": "7-0-1"
    }
  ]
}
```

#### Get Tournament Pairings
```
GET /tournaments/{id}/pairings
```

**Response Shape**:
```json
{
  "data": [
    {
      "round": 1,
      "table": 1,
      "player1Id": "p-abc123",
      "player2Id": "p-def456",
      "result": "1-0"
    }
  ]
}
```

**Scraping Strategy**:
1. Fetch tournaments with format filter: `gen9vgc2026regf*`
2. Parse format strings to extract generation and format name:
   - Example: `gen9vgc2026regf` -> generation: 9, format: "reg f"
   - Example: `gen9vgc2025regc` -> generation: 9, format: "reg c"
3. For each tournament, fetch details, standings, and pairings
4. Parse standings to extract player information
5. Parse pairings to extract match results
6. Store tournament, players, teams, matches, and participants in database

**Limitations**:
- Team lists (actual Pokemon) may not be available via API
- May need to scrape web pages for full team data

---

### 2. RK9.gg Tournament Scraper (Official)

**Base URL**: `https://rk9.gg`

**Pages to Scrape**:
1. **Tournament Page**: General tournament info
2. **Roster Page**: Player list with team lists
3. **Pairings Page**: Round-by-round matchups

**Example URLs**:
```
Tournament: https://rk9.gg/tournament/xyz/
Roster: https://rk9.gg/tournament/xyz/roster/
Pairings: https://rk9.gg/tournament/xyz/pairings/
```

**Roster Page Structure** (example):
```html
<div class="player-entry">
  <div class="player-name">John Doe (USA)</div>
  <div class="team-list">
    <span class="pokemon">Incineroar</span>
    <span class="pokemon">Urshifu-Rapid-Strike</span>
    ...
  </div>
</div>
```

**Pairings Page Structure** (example):
```html
<div class="round" id="round-1">
  <div class="matchup">
    <div class="player1">John Doe</div>
    <div class="result">W-1</div>
    <div class="player2">Jane Smith</div>
  </div>
</div>
```

**Scraping Strategy**:
1. User provides tournament URL manually via CLI
2. Parse tournament page for basic info (name, date, location)
3. Parse roster page for:
   - Player names and countries
   - Team lists (6 Pokemon per player with items, abilities, tera types, moves)
4. Parse pairings page for:
   - Round-by-round matchups
   - Match results (scores for each player)
5. Store tournament, players, teams, pokemon_sets, moves, matches, and participants in database

**Data Points**:
- Tournament name, date, location
- Player names, countries
- Team lists: species, form, item, ability, tera_type
- Moves for each Pokemon
- Match results (player scores)

**Limitations**:
- No official API
- Requires manual URL input
- HTML structure may change
- Rate limiting may be needed

---

## CLI Interface Design

### Commands

```bash
# Scrape Limitless tournaments
vgc-scraper limitless --format gen9vgc2026regf --limit 50

# Scrape RK9 tournament (manual URL)
vgc-scraper rk9 --url "https://rk9.gg/tournament/xyz/"

# Query database
vgc-scraper query --sql "SELECT * FROM tournaments LIMIT 10"

# Export data
vgc-scraper export --format csv --output tournaments.csv --table tournaments

# Start HTTP API server
vgc-scraper serve --port 3000
```

### Example CLI Output

```
$ vgc-scraper limitless --format gen9vgc2026regf --limit 50
[2025-03-15 10:00:00] Starting Limitless scraper...
[2025-03-15 10:00:01] Found 127 tournaments
[2025-03-15 10:00:02] Scraping tournament 1/50: VGC 2026 Reg F - Austin
[2025-03-15 10:00:05] ✓ Saved 127 players
[2025-03-15 10:00:06] Scraping tournament 2/50: VGC 2026 Reg F - Seattle
...
[2025-03-15 10:15:00] ✓ Complete: 50 tournaments, 6,350 players saved
```

## HTTP API Endpoints (if implemented)

```
GET /api/tournaments
GET /api/tournaments/:id
GET /api/players
GET /api/players/:id
POST /api/export?format=csv
```

## Error Handling

1. **Network Errors**:
   - Exponential backoff for retries
   - Log failed requests with timestamps
   - Skip failed items and continue

2. **Rate Limiting**:
   - Respect API rate limits
   - Add delays between requests (RK9 scraping)
   - Use rotating user agents if needed

3. **Data Validation**:
   - Validate required fields before inserting
   - Skip malformed records
   - Log validation errors

4. **Duplicate Handling**:
   - Check for existing tournaments by id
   - Skip already-scraped data
   - Update records if data changed

## Logging

- **Format**: `[YYYY-MM-DD HH:MM:SS] [LEVEL] Message`
- **Levels**: INFO, WARN, ERROR
- **Files**: `logs/scraper-YYYY-MM-DD.log`
- **Console Output**: Progress bars and summaries

## Configuration

### Environment Variables
```
LIMITLESS_API_KEY=your_api_key_here
DB_PATH=./db/vgc.db
LOG_DIR=./logs
```

### Config File (optional)
```json
{
  "limitless": {
    "apiKey": "your_key",
    "baseUrl": "https://api.limitlesstcg.com",
    "rateLimit": 200
  },
  "rk9": {
    "baseUrl": "https://rk9.gg",
    "requestDelay": 1000
  },
  "database": {
    "path": "./db/vgc.db"
  }
}
```

## Data Validation Rules

1. **Tournaments**:
   - Required: name, date, generation, format, official
   - Date must be valid ISO format
   - Generation must be positive integer
   - official must be True or False

2. **Players**:
   - Required: name
   - Country: optional, must be 2-3 letter code if provided

3. **Pokemon Sets**:
   - Required: species, team_id
   - Species must match Showdown format (e.g., "Urshifu-Rapid-Strike")

4. **Match Participants**:
   - Required: match_id, player_id, team_id, score
   - Score must be non-negative integer

## Future Enhancements

1. **Showdown Data Integration**:
   - Add CTS (Closed Team Sheet) data from Showdown moveset files
   - Add `pokemon_set_details` table for EVs, natures, IVs
   - Parse moveset files for detailed stat distributions

2. **Advanced Queries**:
   - Common Pokemon pairs analysis
   - Common stat investments for Pokemon (when CTS data is added)
   - Strong and weak matchups for similar teams
   - Damage calculator integration

3. **Visualizations**:
   - Usage trend charts
   - Player performance graphs
   - Pokemon popularity heatmaps

4. **Real-time Updates**:
   - Scheduled scraping (daily/weekly)
   - Webhook notifications for new tournaments

5. **Data Export**:
   - JSON, CSV, SQLite exports
   - Custom query builder UI

## Dependencies

### Python

- Database: `sqlite3` (built-in)
- HTTP Client: `requests` or `httpx`
- HTML Parsing: `beautifulsoup4` or `lxml`
- CLI: `click`
- Logging: `structlog` or `logging` (built-in)
- Server: `fastapi` or `flask` (if implementing HTTP API)

Install with:
```bash
pip install requests beautifulsoup4 click structlog
```

## Notes

- This is a personal project, not for production use
- Database size estimated: multi-tens of thousands of records
- Rate limits should be respected to avoid being blocked
- RK9.gg may block aggressive scraping - use reasonable delays
- Limitless data is available back to ~2019
- Player count can be queried from the teams table: `SELECT COUNT(DISTINCT player_id) FROM teams WHERE tournament_id = ?`
