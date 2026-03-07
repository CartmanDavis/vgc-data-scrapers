import sqlite3
import statistics
from itertools import combinations

# Connect to the database
conn = sqlite3.connect('db/vgc.db')
cursor = conn.cursor()

# Query to get all teams in SVF with their Pokemon and win_rate
query = """
SELECT t.id,
       (SELECT GROUP_CONCAT(ps.species) FROM pokemon_sets ps WHERE ps.team_id = t.id) AS pokemon_list,
       (ts.wins * 1.0 / (ts.wins + ts.losses)) AS win_rate
FROM teams t
JOIN tournaments tour ON t.tournament_id = tour.id
JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
WHERE tour.format = 'SVF'
AND ts.wins + ts.losses > 0
"""

cursor.execute(query)
rows = cursor.fetchall()
N = len(rows)
print(f"Total teams: {N}")

# Dictionary for pairs: frozenset(pair): list of win_rates
pairs = {}

for team_id, pokemon_str, win_rate in rows:
    if pokemon_str is None:
        continue
    pokemon = sorted(pokemon_str.split(','))
    if len(pokemon) < 2:
        continue  # need at least 2 for a pair

    # Generate all pairs
    for pair in combinations(pokemon, 2):
        key = frozenset(pair)
        if key not in pairs:
            pairs[key] = []
        pairs[key].append(win_rate)

# Get top pairs by avg win_rate, with count >= 25 (similar to the script)
threshold = 25
items = []
for key, rates in pairs.items():
    count = len(rates)
    if count >= threshold:
        avg = statistics.mean(rates)
        items.append((key, count, avg))

items.sort(key=lambda x: x[2], reverse=True)

# Print top 10
print("Top 10 duos by average win rate in Regulation F:")
print("| Duo | Count | Avg Win Rate |")
print("|-----|-------|--------------|")
for fs, c, a in items[:10]:
    duo = '+'.join(sorted(fs))
    print(f"| {duo} | {c} | {a:.3f} |")

conn.close()