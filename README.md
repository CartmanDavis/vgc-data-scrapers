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

```bash

python main.py limitless --format gen9vgc2026regf --limit 50
```

Options:

- `--format`: Format filter (e.g., gen9vgc2026regf)
- `--limit`: Maximum number of tournaments to scrape
- `--since`: Only scrape tournaments after this date (YYYY-MM-DD format)
- `--api-key`: Override API key

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

- `tournaments`: Tournament information
- `players`: Player information
- `teams`: Team lists used in tournaments
- `pokemon_sets`: Individual Pokemon sets
- `moves`: Moves for each Pokemon set
- `matches`: Match information
- `match_participants`: Players/teams participating in matches

See `TECHNICAL_OVERVIEW.md` for detailed schema information.

## Example Queries

Find common Pokemon pairs:

```sql

SELECT p1.species, p2.species, COUNT(*) as pair_count
FROM pokemon_sets p1
JOIN pokemon_sets p2 ON p1.team_id = p2.team_id
WHERE p1.id < p2.id
GROUP BY p1.species, p2.species
ORDER BY pair_count DESC
LIMIT 10;
```

Get player count by tournament:

```sql

SELECT t.name, COUNT(DISTINCT tp.player_id) as player_count
FROM tournaments t
JOIN teams tp ON t.id = tp.tournament_id
GROUP BY t.id
ORDER BY player_count DESC;
```

Find tournament leaders:

```sql

SELECT mp.player_id, p.name, COUNT(*) as match_wins
FROM match_participants mp
JOIN match_participants mp2 ON mp.match_id = mp2.match_id AND mp.score > mp2.score
JOIN players p ON mp.player_id = p.id
GROUP BY mp.player_id
ORDER BY match_wins DESC;
```
