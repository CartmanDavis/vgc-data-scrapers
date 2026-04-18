# Approach to VGC Wrapped Analysis

## Overview

Creating a VGC Wrapped analysis requires balancing quantitative data analysis
with qualitative narrative construction. This document outlines the approach
taken for Cartman's analysis and provides a template for analyzing other
players.

---

## Phase 1: Data Extraction

### Key Queries

**1. Basic Player Profile**

- Player ID lookup by name
- Total tournaments, wins, losses, win rate
- Career trajectory over time

**2. Tournament History**

```sql
SELECT t.name, t.date, t.format, ts.placing, ts.wins, ts.losses
FROM tournament_standings ts
JOIN tournaments t ON ts.tournament_id = t.id
WHERE ts.player_id = ?
ORDER BY t.date DESC;
```

**3. Team Compositions**

```sql
SELECT t.id, GROUP_CONCAT(DISTINCT p.species) as team
FROM tournaments t
JOIN teams tm ON t.id = tm.tournament_id
JOIN pokemon_sets p ON tm.id = p.team_id
JOIN tournament_standings ts ON tm.id = ts.team_id
WHERE tm.player_id = ?
GROUP BY t.id;
```

**4. Movesets**

```sql
SELECT p.species, GROUP_CONCAT(m.move_name) as moves
FROM pokemon_sets p
JOIN moves m ON p.id = m.pokemon_set_id
JOIN teams tm ON p.team_id = tm.id
WHERE tm.player_id = ?
GROUP BY p.species, p.ability, p.tera_type;
```

**5. Format Breakdown**

```sql
SELECT t.format, COUNT(*) as tournaments,
       SUM(ts.wins) as wins, SUM(ts.losses) as losses,
       ROUND(CAST(SUM(ts.wins) AS FLOAT) / CAST((SUM(ts.wins) + SUM(ts.losses)) AS FLOAT) * 100, 1) as win_rate
FROM tournament_standings ts
JOIN tournaments t ON ts.tournament_id = t.id
WHERE ts.player_id = ?
GROUP BY t.format;
```

**6. Opponent Analysis**

- Identify frequent opponents
- Categorize opponents by skill level (overall win rate)
- Calculate performance vs elite, average, and struggling players

---

## Phase 2: Pattern Identification

### Questions to Answer

1. **Team Architecture**
   - What core combinations appear repeatedly?
   - Which Pokemon are anchors (used across many teams)?
   - Which Pokemon are niche partners (used sparingly)?
   - Are there named team archetypes?
   - Was this strategy unique, or did many other players use it?

2. **Strategic Patterns**
   - What types of speed control are used? (Tailwind, Trick Room, priority)
   - What anti-meta technology appears? (Clear Smog, Haze, Taunt, Weezing).
     These can be found by looking at usages of pokemon/abilities/moves with
     high win rates in the metagame.
   - How do teams handle opposing strategies (setup sweepers, tailwind, balance,
     trick room, weather)?

3. **Format Adaptation**
   - Which formats produced the best results?
   - What was the learning curve within each format?
   - Did the player struggle with format transitions?

4. **Meta Positioning**
   - Does the player follow the meta or break it?
   - Are innovations in structure or execution?
   - How do movesets compare to meta standards?

---

## Phase 3: Narrative Construction

### Structure

1. **The Hook** - Opening stats that grab attention
2. **Format Context** - Performance by format, establishing the journey
3. **Team Deep Dives** - Named archetypes with descriptions
4. **Innovation Patterns** - Recurring strategic themes
5. **The Verdict** - Synthesis of strengths and weaknesses
6. **Forward Looking** - Recommendations for improvement

### Key Narrative Techniques

- **Named Archetypes** - Give teams memorable names (Dozo Cringe, Walking Woke
  SunRoom)
- **Data-Backed Claims** - Every assertion needs a query or calculation
- **Percentages with Context** - Team win rate vs format win rate
- **Quote-Unquote Style** - Personality in the writing ("Mamma Mia!", "You woke
  up and chose violence")
- **Pattern Synthesis** - Don't just list observations; connect them

---

## Phase 4: Iterative Refinement

### What Was Refined

1. **Format Names** - Changed from Limitless codes (23S2) to official names
   (Regulation B)
2. **Team Naming** - Added nicknames based on Pokemon combinations
3. **Section Reorganization** - Moved format summary to introduction
4. **Claims Verification** - Corrected misconceptions about team compositions
5. **Data Accuracy** - Replaced derived metrics with actual calculated values

### Questions That Guided Refinement

- "What makes this team unique?"
- "Is this pattern consistent or one-time?"
- "What's the difference between team win rate and format win rate?"
- "Does this innovation follow the meta or break it?"

---

## Common Queries for Any Player

| Metric           | Query Focus                             |
| ---------------- | --------------------------------------- |
| Career totals    | wins + losses + ties by player          |
| Best formats     | win rate by format                      |
| Best teams       | unique team compositions with win rates |
| Innovation index | rare Pokemon/abilities/tera types       |
| Anti-meta tech   | uncommon moves on common Pokemon        |
| Opponent quality | win rate vs players with 60%+ career WR |
| Trend over time  | monthly or format-phase performance     |

---

## Red Flags to Watch

- **High-variance teams** - Teams with extreme win rates (80%+ or 30%-) indicate
  volatility
- **Single-format specialists** - Players who dominate one format but struggle
  elsewhere
- **Counter-pick reliance** - Teams that only work when opponents aren't
  prepared
- **Copy-paste patterns** - Using the same team across many tournaments without
  iteration

---

## Output Template

```markdown
# [Player Name]'s VGC Wrapped

## The Numbers

[Career totals, highlight growth or decline]

## Format-by-Format Summary

[Table with format, teams, format WR, best team, team WR]

## The Unique Teams

[Named archetypes with descriptions]

## Innovation Patterns

[Recurring strategic themes with data backing]

## The Toughest Matchup

[Notable opponent analysis]

## The Verdict

[Synthesis of strengths and weaknesses]

## Forward Looking

[Recommendations for improvement]
```

---

## Tone and Voice

The tone should be **encouraging but objective**. No platitudes. No false
positivity. Identify what's working, what's not, and what's actionable.

### Principles

**1. Acknowledge reality without being harsh**

- ❌ "You struggled in Regulation E and that was a failure."
- ✅ "Regulation E exposed vulnerabilities that suggest piloting demands
  exceeded current mastery."

**2. Celebrate wins with data**

- ❌ "Great job!"
- ✅ "Dozo Cringe achieved a 71.4% win rate across 10 tournaments—your most
  successful team by every measure."

**3. Frame negatives as opportunities**

- ❌ "You lost to bad players too often."
- ✅ "Against below-average opponents, you won placement 78.3% of the
  time—indicating consistent execution against expected targets."

**4. Be specific about improvement paths**

- ❌ "Try harder next time."
- ✅ "The learning curve pattern (49% → 68% in Regulation C) suggests faster
  adaptation is possible with focused practice on format fundamentals."

**5. Avoid jargon without explanation**

- Use terms like "anchor Pokemon" or "anti-meta tech" but define them through
  examples, not definitions.

### Phrases to Use and Avoid

| Use                            | Avoid                        |
| ------------------------------ | ---------------------------- |
| "The data suggests..."         | "Clearly..."                 |
| "This pattern indicates..."    | "Obviously..."               |
| "An opportunity for growth..." | "You need to fix..."         |
| "Consistent with..."           | "Just like everyone else..." |
| "X% improvement shows..."      | "Finally, you got lucky..."  |

### Example Transformation

**Before (too harsh):** "Your Weezing Control team was a disaster. You went 0-5
twice and the whole concept was too demanding for your skill level at the time.
This was a mistake."

**After (encouraging but objective):** "Weezing Control demonstrated both your
ceiling and floor. The team achieved 57% win rate when it worked but collapsed
when positioning failed. This pattern—high variance, high ceiling—is worth
revisiting once piloting mastery catches up to the team's potential."

---

## Lessons Learned

1. **Start with structure** - Extract all team compositions before analyzing
2. **Name things** - Named archetypes are more memorable than descriptions
3. **Compare to the meta** - A team's uniqueness is defined by what's NOT in it
4. **Data tells stories** - The 49% → 68% learning curve in Regulation C is more
   powerful than just saying "improved"
5. **Context matters** - 40% win rate on a new team in a competitive field is
   different from 40% on an established team
6. **Iterate with the player** - The best insights came from user feedback and
   clarification
7. **Tone is everything** - Encouraging + objective beats both toxic negativity
   and false positivity
