# VGC Analytics Scraper - Technical Overview

## Architecture

This project scrapes competitive Pokemon VGC analytics data from:

1. **Limitless API** (limitlesstcg.com) - Grassroots tournaments
2. **RK9.gg** - Official tournament results via HTML scraping

All data is stored in SQLite (`db/vgc.db`).

## Data Pipeline

```
┌─────────────┐     ┌─────────────┐
│  Limitless  │     │    RK9.gg   │
│     API     │     │   Scraper   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └─────────┬─────────┘
                 ▼
        ┌───────────────┐
        │      Raw      │
        │   Data SQL    │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │   Processor   │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │   Normalized  │
        │     Tables    │
        └───────────────┘
```

### Stage 1: Scrape Raw Data

CLI scripts fetch data and store raw JSON in SQL tables:
- `limitless_api_raw_data` - Raw Limitless API responses

### Stage 2: Process Raw Data

CLI script parses JSON and populates normalized tables:
- `tournaments`, `players`, `teams`, `pokemon_sets`, `moves`, `matches`, `match_participants`

## Data Sources

### Limitless API (Unofficial)

**Base URL**: `https://api.limitlesstcg.com`
**Authentication**: Header `X-Access-Key`
**Rate Limit**: 200 requests/minute

**Endpoints Used**:
- `GET /tournaments?format={format}&page={page}` - List tournaments
- `GET /tournaments/{id}/details` - Tournament metadata
- `GET /tournaments/{id}/standings` - Player placements, records, decklists
- `GET /tournaments/{id}/pairings` - Match pairings and results

### RK9.gg Scraper (Official)

**Base URL**: `https://rk9.gg`

Pages scraped:
1. Tournament page - Basic info (name, date)
2. Roster page - Player names, countries, team lists
3. Pairings page - Round matchups and results

## Database Schema

### Raw Data Tables

#### `limitless_api_raw_data`

| Column    | Type      | Description                        |
| --------- | --------- | ---------------------------------- |
| id        | TEXT (PK) | Tournament ID                      |
| details   | TEXT      | Raw JSON from `/details` endpoint  |
| standings | TEXT      | Raw JSON from `/standings` endpoint|
| pairings  | TEXT      | Raw JSON from `/pairings` endpoint |

### Normalized Tables

#### `tournaments`

| Column     | Type      | Description                   |
| ---------- | --------- | ----------------------------- |
| id         | TEXT (PK) | Unique identifier             |
| name       | TEXT      | Tournament name               |
| date       | DATETIME  | Tournament date               |
| location   | TEXT      | Tournament location           |
| generation | INTEGER   | Generation number (e.g., 9)   |
| format     | TEXT      | Format name (e.g., "reg f")   |
| official   | BOOLEAN   | True = RK9, False = Limitless |

#### `players`

| Column  | Type         | Description         |
| ------- | ------------ | ------------------- |
| id      | INTEGER (PK) | Auto-generated ID   |
| name    | TEXT         | Player name         |
| country | TEXT         | Player country code |

#### `teams`

| Column        | Type         | Description          |
| ------------- | ------------ | -------------------- |
| id            | INTEGER (PK) | Auto-generated ID    |
| player_id     | INTEGER (FK) | FK to players.id     |
| tournament_id | TEXT (FK)    | FK to tournaments.id |

#### `pokemon_sets`

| Column    | Type         | Description             |
| --------- | ------------ | ----------------------- |
| id        | INTEGER (PK) | Auto-generated          |
| team_id   | INTEGER (FK) | FK to teams.id          |
| species   | TEXT         | Pokemon species name    |
| form      | TEXT         | Form variant (optional) |
| item      | TEXT         | Held item               |
| ability   | TEXT         | Pokemon ability         |
| tera_type | TEXT         | Tera type               |

#### `moves`

| Column         | Type         | Description           |
| -------------- | ------------ | --------------------- |
| id             | INTEGER (PK) | Auto-generated        |
| pokemon_set_id | INTEGER (FK) | FK to pokemon_sets.id |
| move_name      | TEXT         | Move name             |

#### `matches`

| Column        | Type         | Description          |
| ------------- | ------------ | -------------------- |
| id            | INTEGER (PK) | Auto-generated       |
| tournament_id | TEXT (FK)    | FK to tournaments.id |
| round_number  | INTEGER      | Round number         |
| table_number  | INTEGER      | Table number         |
| phase         | INTEGER      | Tournament phase     |

#### `match_participants`

| Column    | Type         | Description               |
| --------- | ------------ | ------------------------- |
| id        | INTEGER (PK) | Auto-generated            |
| match_id  | INTEGER (FK) | FK to matches.id          |
| player_id | INTEGER (FK) | FK to players.id          |
| team_id   | INTEGER (FK) | FK to teams.id            |
| score     | INTEGER      | Games won (0, 1, 2, etc.) |

## Error Handling

1. **Network Errors**: Exponential backoff, logged, skip failed items
2. **Rate Limiting**: Respect API limits, add delays for RK9
3. **Data Validation**: Validate required fields before insert
4. **Duplicate Handling**: Check existing data, skip duplicates

## Logging

- **Format**: JSON with timestamp and level
- **Files**: `logs/scraper-YYYY-MM-DD.log`
