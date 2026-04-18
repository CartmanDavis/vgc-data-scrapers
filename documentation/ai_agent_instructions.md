# AI Agent Instructions for VGC Usage Stats

This document provides guidance for AI agents on how to effectively use the
tools and database in this VGC analytics repository.

## Overview

This repository scrapes, processes, and analyzes competitive Pokemon VGC
tournament data from Limitless and RK9.gg. The system uses a two-stage pipeline:

1. **Scraping**: Collect raw data from APIs/websites
2. **Processing**: Normalize raw data into queryable tables
3. **Analysis**: Query processed data for insights and visualizations

## Available Tools

### CLI Commands (TypeScript/Node.js)

Use these npm scripts for data operations:

```bash
# Scrape Limitless tournaments
npm run limitless -- --format gen9vgc2026regf --limit 50

# Scrape specific RK9 tournament
npm run rk9 -- --url "https://rk9.gg/tournament/example/"

# Process raw data into normalized tables
npm run process -- --source limitless

# Query the database
npm run query -- --tournaments --limit 10
npm run query -- --players --limit 10
npm run query -- --sql "SELECT * FROM tournaments WHERE official = 1"
```

### Database Direct Access

The SQLite database is at `db/vgc.db`. You can connect directly for complex
queries.

## Best Practices for AI Agents

### 1. Data Pipeline Workflow

**Always follow this sequence for fresh data:**

1. **Scrape** → Store raw data
2. **Process** → Normalize into clean tables
3. **Query/Analyze** → Extract insights

**Never skip processing** - always run the process command after scraping before
analyzing.

### 2. Efficient Scraping

- Use `--limit` to control data volume
- Use `--since` to get recent tournaments only
- Respect rate limits (Limitless: 200 req/min, RK9: add delays)

### 3. Query Patterns

#### Tournament Analysis

```sql
-- Recent official tournaments
SELECT * FROM tournaments
WHERE official = 1 AND date >= '2024-01-01'
ORDER BY date DESC;

-- Tournament participation by format
SELECT format, COUNT(*) as count
FROM tournaments
GROUP BY format
ORDER BY count DESC;
```

#### Player Analysis

```sql
-- Top players by tournament wins
SELECT p.name, COUNT(*) as tournaments_won
FROM players p
JOIN tournament_standings ts ON p.id = ts.player_id
WHERE ts.placing = 1
GROUP BY p.id, p.name
ORDER BY tournaments_won DESC;

-- Player performance across tournaments
SELECT p.name, t.name as tournament, ts.placing, ts.wins, ts.losses
FROM players p
JOIN tournament_standings ts ON p.id = ts.player_id
JOIN tournaments t ON ts.tournament_id = t.id
WHERE p.name = 'PlayerName'
ORDER BY t.date DESC;
```

#### Pokemon Usage Analysis

```sql
-- Most used Pokemon in recent tournaments
SELECT ps.species, COUNT(*) as usage_count
FROM pokemon_sets ps
JOIN teams tm ON ps.team_id = tm.id
JOIN tournaments t ON tm.tournament_id = t.id
WHERE t.date >= '2024-01-01'
GROUP BY ps.species
ORDER BY usage_count DESC;

-- Popular moves for a specific Pokemon
SELECT m.move_name, COUNT(*) as usage
FROM moves m
JOIN pokemon_sets ps ON m.pokemon_set_id = ps.id
WHERE ps.species = 'Charizard'
GROUP BY m.move_name
ORDER BY usage DESC;
```

#### Match Analysis

```sql
-- Tournament results summary
SELECT t.name, COUNT(m.id) as total_matches,
       AVG(mp.score) as avg_score_per_match
FROM tournaments t
LEFT JOIN matches m ON t.id = m.tournament_id
LEFT JOIN match_participants mp ON m.id = mp.match_id
GROUP BY t.id, t.name;
```

### 4. Data Validation

- Check for data completeness before analysis
- Validate tournament dates and formats
- Ensure processed tables have data after running process command

### 5. Common Analysis Tasks

#### Usage Statistics

- Pokemon popularity by format/generation
- Item/ability/tera type trends
- Move usage patterns

#### Player Performance

- Win rates by format
- Tournament consistency
- Regional representation

#### Tournament Insights

- Format popularity over time
- Competition level trends
- Match outcome patterns

### 6. Visualization Integration

The repository includes Python visualization scripts in `visualization/`. Use
these for data insights:

```bash
python visualization/visualizations_player_stats.py
python visualization/visualizations.py
```

### 7. Error Handling

- Check logs in `logs/` for scraping/processing errors
- Verify database integrity after operations
- Handle network timeouts gracefully

### 8. Performance Considerations

- Use indexes for large queries (database has them on key fields)
- Limit result sets for interactive queries
- Batch operations when processing large datasets

## Example AI Agent Workflow

1. **Check current data state:**

   ```bash
   npm run query -- --sql "SELECT COUNT(*) FROM tournaments"
   ```

2. **Scrape new data:**

   ```bash
   npm run limitless -- --since 2024-01-01 --limit 20
   npm run process -- --source limitless
   ```

3. **Analyze trends:**

   ```sql
   SELECT format, COUNT(*) as tournaments,
          AVG(placing) as avg_placing
   FROM tournaments t
   JOIN tournament_standings ts ON t.id = ts.tournament_id
   WHERE t.date >= '2024-01-01'
   GROUP BY format;
   ```

4. **Generate insights:**
   - Identify rising Pokemon
   - Track format popularity
   - Analyze player performance

## Database Schema Reference

See `documentation/data_overview.md` for complete table schemas and
relationships.

Key tables:

- `tournaments`: Tournament metadata
- `players`: Player information
- `teams`: Player teams in tournaments
- `pokemon_sets`: Pokemon builds
- `moves`: Moves per Pokemon
- `matches`: Tournament matches
- `match_participants`: Match results
- `tournament_standings`: Final placements

## Configuration

- API keys: Set in `config.json` or environment variables
- Database path: Default `./db/vgc.db`
- Logs: `logs/scraper-YYYY-MM-DD.log`

Always check `config.example.json` for required settings before running
scrapers.

