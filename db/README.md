# Database

SQLite database storing VGC tournament data.

## Schema

### tournaments
Tournament information from Limitless and RK9.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Unique tournament ID |
| name | TEXT | Tournament name |
| date | DATETIME | Tournament date |
| location | TEXT | Tournament location |
| generation | INTEGER | Pokemon generation (9 = SV) |
| format | TEXT | Format (e.g., SVF, SVG) |
| official | BOOLEAN | Whether official tournament |

### players
Player information.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| name | TEXT | Player name |
| country | TEXT | Player country code |

### teams
Team assignments linking players to tournaments.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| player_id | INTEGER | FK to players |
| tournament_id | TEXT | FK to tournaments |
| | | UNIQUE(player_id, tournament_id) |

### pokemon_sets
Pokemon on each team.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| team_id | INTEGER | FK to teams |
| species | TEXT | Pokemon species name |
| form | TEXT | Pokemon form (e.g., Ogerpon) |
| item | TEXT | Held item |
| ability | TEXT | Pokemon ability |
| tera_type | TEXT | Tera type |

### moves
Moves learned by each Pokemon.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| pokemon_set_id | INTEGER | FK to pokemon_sets |
| move_name | TEXT | Move name |

### matches
Match records within tournaments.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| tournament_id | TEXT | FK to tournaments |
| round_number | INTEGER | Match round |
| table_number | INTEGER | Table number |
| phase | INTEGER | Tournament phase |

### match_participants
Players in each match with scores.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| match_id | INTEGER | FK to matches |
| player_id | INTEGER | FK to players |
| team_id | INTEGER | FK to teams |
| score | INTEGER | Match score |
| | | UNIQUE(match_id, player_id) |

### tournament_standings
Final standings for each player in a tournament.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID |
| tournament_id | TEXT | FK to tournaments |
| player_id | INTEGER | FK to players |
| team_id | INTEGER | FK to teams |
| placing | INTEGER | Final placement |
| wins | INTEGER | Total wins |
| losses | INTEGER | Total losses |
| ties | INTEGER | Total ties |
| dropped | BOOLEAN | Whether player dropped |
| | | UNIQUE(tournament_id, player_id) |

### limitless_api_raw_data
Raw API responses from Limitless (for re-processing).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Tournament ID (FK) |
| details | TEXT | JSON tournament details |
| standings | TEXT | JSON standings |
| pairings | TEXT | JSON pairings |
| | | CASCADE DELETE on tournament |

## Indexes

- `idx_tournaments_date` - Tournament date lookups
- `idx_tournaments_generation_format` - Filter by gen/format
- `idx_teams_tournament` - Teams per tournament
- `idx_pokemon_sets_team` - Pokemon per team
- `idx_matches_tournament` - Matches per tournament
- `idx_tournament_standings_tournament` - Standings per tournament
- `idx_tournament_standings_player` - Player standings history

## Location

Default: `db/vgc.db`

Configure in `config.json`:
```json
{
  "database": {
    "path": "./db/vgc.db"
  }
}
```
