# Mega Pokemon Item Queries

This document explains how to query Mega Pokemon data from the database.

## Identifying Mega Items

Mega items end in "ite" (e.g., Charizardite Y, Gengarite, Tyranitarite). However, there are some complications:

1. **Items to exclude**:
   - `Eviolite` - Not a Mega item; used by unevolved Pokemon like Porygon2 and Dusclops
   - `No Item`, `White Herb`, `no item`, `white herb` - Not valid items for Mega analysis

2. **Capitalization variations**: The same item may appear with different capitalizations:
   - `Charizardite Y` vs `charizardite y`
   - `Gengarite` vs `gengarite`
   - `floettite` vs `Floettite`

## Canonical Mega Items

The known Mega items are:

| Item | Pokemon |
|------|---------|
| Charizardite Y | Mega Charizard Y |
| Charizardite X | Mega Charizard X |
| Charizardite Y | Mega Charizard Y |
| Floettite | Mega Floette / Floette |
| Gengarite | Mega Gengar / Gengar |
| Tyranitarite | Mega Tyranitar / Tyranitar |
| Froslassite | Mega Froslass / Froslass |
| Dragoninite | Mega Dragonite / Dragonite |
| Delphoxite | Mega Delphox / Delphox |
| Gardevoirite | Mega Gardevoir / Gardevoir |
| Glimmoranite | Mega Glimmora |
| Meganiumite | Mega Meganium / Meganium |
| Kangaskhanite | Mega Kangaskhan / Kangaskhan |
| Aerodactylite | Mega Aerodactyl / Aerodactyl |
| Golurkite | Mega Golurk / Golurk |
| Venusaurite | Mega Venusaur / Venusaur |
| Starminite | Mega Starmie |
| Scizorite | Mega Scizor / Scizor |
| Aggronite | Mega Aggron / Aggron |
| Scovillainite | Mega Scovillain |
| Garchompite | Mega Garchomp / Garchomp |
| Crabominite | Mega Crabominable |
| Gyaradosite | Mega Gyarados / Gyarados |
| Lucarionite | Mega Lucario / Lucario |
| Drampanite | Mega Drampa |
| Blastoisinite | Mega Blastoise / Blastoise |
| Feraligite | Mega Feraligatr |
| Lopunnite | Mega Lopunny |
| Chesnaughtite | Mega Chesnaught |
| Skarmorite | Mega Skarmory |
| Hawluchanite | Mega Hawlucha |
| Cameruptite | Mega Camerupt |
| Manectite | Mega Manectric |
| Excadrite | Mega Excadrill |
| Meowsticite | Mega Meowstic |
| Galladite | Mega Gallade |
| Greninjite | Mega Greninja |
| Ampharosite | Mega Ampharos |
| Clefablite | Mega Clefable |
| Chandelurite | Mega Chandelure |
| Slowbronite | Mega Slowbro |
| Salamencite | Mega Salamence |
| Altarianite | Mega Altaria |
| Alakazite | Mega Alakazam |
| Heracronite | Mega Heracross |
| Chimechite | Mega Chimecho |
| Metagrossite | Mega Metagross |
| Abomasite | Mega Abomasnow |
| Dragonitite | Mega Dragonite |
| Swampertite | Mega Swampert |
| Sharpedonite | Mega Sharpedo |
| Sablenite | Mega Sableye |
| Pinsirite | Mega Pinsir |
| Steelixite | Mega Steelix |
| Emboarite | Mega Emboar |
| Dragalgite | Mega Dragalge |
| Absolite | Mega Absol |
| Victreebelite | Mega Victreebel |
| Medichamite | Mega Medicham |
| Houndoominite | Mega Houndoom |
| Beedrillite | Mega Beedrill |
| Raichunite X | Mega Raichu X |
| Pidgeotite | Mega Pidgeot |
| Mawilite | Mega Mawile |
| Feraligatrite | Mega Feraligatr |
| Absolite Z | Mega Absol Z |
| Garchompite Z | Mega Garchomp Z |
| Lucarionite Z | Mega Lucario Z |

## SQL Query Pattern

### Basic Mega Item Query (Last 3 Weeks)

```sql
WITH recent_tournaments AS (
    SELECT id FROM tournaments WHERE date >= '2026-03-24'
),
canonical_items AS (
    SELECT 'Charizardite Y' as item UNION ALL
    SELECT 'Charizardite X' UNION ALL
    SELECT 'Floettite' UNION ALL
    SELECT 'Gengarite' UNION ALL
    -- ... (all other canonical items)
),
team_items AS (
    SELECT DISTINCT t.id as team_id, ci.item
    FROM teams t
    JOIN pokemon_sets ps ON t.id = ps.team_id
    JOIN canonical_items ci ON LOWER(ps.item) = LOWER(ci.item)
    WHERE t.tournament_id IN (SELECT id FROM recent_tournaments)
),
total_mega_teams AS (
    SELECT COUNT(DISTINCT team_id) as cnt FROM team_items
)
SELECT
    ti.item,
    COUNT(DISTINCT ti.team_id) as usage_count,
    ROUND(CAST(COUNT(DISTINCT ti.team_id) AS REAL) * 100 / total_mega_teams.cnt, 2) as usage_pct,
    ROUND(CAST(SUM(mp.score) AS REAL) / CAST(COUNT(*) AS REAL) * 100, 2) as win_rate
FROM team_items ti
JOIN match_participants mp ON ti.team_id = mp.team_id,
total_mega_teams
GROUP BY ti.item
ORDER BY usage_count DESC;
```

### Key Points

1. **Use `LOWER()` for case-insensitive matching** - Handles variations like `floettite` vs `Floettite`

2. **Excluded items** - Filter out `Eviolite`, `No Item`, `White Herb` (case-insensitive)

3. **Count teams, not Pokemon occurrences** - A team may have multiple Pokemon with the same item, but we want distinct teams

4. **Win rate calculation** - `SUM(mp.score) / COUNT(*)` gives win rate per match appearance of that item's team

## Head-to-Head (H2H) Queries

To compare two Mega items directly:

```sql
WITH recent_tournaments AS (
    SELECT id FROM tournaments WHERE date >= '2026-03-24'
),
team_items AS (
    SELECT DISTINCT t.id as team_id, ps.item
    FROM teams t
    JOIN pokemon_sets ps ON t.id = ps.team_id
    WHERE t.tournament_id IN (SELECT id FROM recent_tournaments)
    AND ps.item IN (SELECT DISTINCT item FROM pokemon_sets WHERE item LIKE '%ite%')
    AND LOWER(ps.item) NOT IN ('no item', 'white herb', 'eviolite')
),
matchup_data AS (
    SELECT
        mp.match_id,
        mp.team_id as team1_id,
        mp2.team_id as team2_id,
        mp.score as score1,
        mp2.score as score2
    FROM match_participants mp
    JOIN match_participants mp2 ON mp.match_id = mp2.match_id
        AND mp.id != mp2.id
        AND mp.team_id < mp2.team_id
    WHERE mp.match_id IN (
        SELECT id FROM matches WHERE tournament_id IN (SELECT id FROM recent_tournaments)
    )
)
SELECT
    ti1.item as item1,
    ti2.item as item2,
    COUNT(*) as matches,
    SUM(CASE WHEN mu.score1 > mu.score2 THEN 1 ELSE 0 END) as item1_wins,
    SUM(CASE WHEN mu.score2 > mu.score1 THEN 1 ELSE 0 END) as item2_wins,
    ROUND(CAST(SUM(CASE WHEN mu.score1 > mu.score2 THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*), 2) as item1_winrate
FROM team_items ti1
JOIN team_items ti2 ON ti1.team_id < ti2.team_id
JOIN matchup_data mu ON (mu.team1_id = ti1.team_id AND mu.team2_id = ti2.team_id)
WHERE ti1.item < ti2.item
GROUP BY ti1.item, ti2.item
ORDER BY matches DESC;
```

## Mega Combos Query

To analyze which Mega items are used together on teams:

```sql
WITH recent_tournaments AS (
    SELECT id FROM tournaments WHERE date >= '2026-03-24'
),
canonical_items AS (
    SELECT 'Charizardite Y' as item UNION ALL
    SELECT 'Charizardite X' UNION ALL
    -- ... (all other canonical items)
),
team_items AS (
    SELECT DISTINCT t.id as team_id, ci.item
    FROM teams t
    JOIN pokemon_sets ps ON t.id = ps.team_id
    JOIN canonical_items ci ON LOWER(ps.item) = LOWER(ci.item)
    WHERE t.tournament_id IN (SELECT id FROM recent_tournaments)
),
total_mega_teams AS (
    SELECT COUNT(DISTINCT team_id) as cnt FROM team_items
),
team_combos AS (
    SELECT team_id, GROUP_CONCAT(item, ' + ') as combo
    FROM (SELECT team_id, item FROM team_items ORDER BY item)
    GROUP BY team_id
),
combo_counts AS (
    SELECT tc.combo,
           COUNT(*) as cnt,
           total_mega_teams.cnt as total
    FROM team_combos tc
    CROSS JOIN total_mega_teams
    GROUP BY tc.combo
),
combo_with_results AS (
    SELECT cc.combo,
           cc.cnt as usage_count,
           ROUND(CAST(cc.cnt AS REAL) * 100 / cc.total, 2) as usage_pct,
           mp.score
    FROM combo_counts cc
    JOIN match_participants mp ON cc.combo = (
        SELECT GROUP_CONCAT(item, ' + ') 
        FROM (SELECT team_id, item FROM team_items ORDER BY item)
        WHERE team_id = mp.team_id
    )
)
SELECT 
    combo,
    MAX(usage_count) as usage_count,
    MAX(usage_pct) as usage_pct,
    ROUND(CAST(SUM(score) AS REAL) / CAST(COUNT(*) AS REAL) * 100, 2) as win_rate
FROM combo_with_results
GROUP BY combo
HAVING MAX(usage_count) >= 10
ORDER BY MAX(usage_count) DESC;
```

**Key Points:**

1. **Sort items alphabetically** in `team_combos` CTE - This ensures "A + B" and "B + A" are counted as the same combo
2. **Count teams once per combo** - Each distinct team-combo combination is counted exactly once
3. **Usage % is based on total mega teams** - Divide combo count by total distinct mega teams
4. **Filter with HAVING** - Remove low-frequency combos that may skew data

## Notes

- Mega Evolution was removed in Gen 8, but custom formats (like "VGC23" for Gen 9) may allow them
- Some items in the database are typos or invalid items - always filter and validate
- Floette is NOT a Mega Evolution Pokemon, but Floettite is included as it's commonly used in the data (likely a mislabeling issue from paste formatting)