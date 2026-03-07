import sqlite3
import statistics

# Connect to the database
conn = sqlite3.connect('db/vgc.db')
cursor = conn.cursor()

# Query to get partners and win_rate
query = """
SELECT (SELECT GROUP_CONCAT(DISTINCT ps.species) FROM pokemon_sets ps WHERE ps.team_id = t.id AND ps.species NOT IN ('Chien-Pao', 'Dragonite') ORDER BY ps.species) AS partners,
(ts.wins * 1.0 / (ts.wins + ts.losses)) AS win_rate
FROM teams t
JOIN tournaments tour ON t.tournament_id = tour.id
JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
WHERE tour.format = 'SVF'
AND ts.wins + ts.losses > 0
AND EXISTS (SELECT 1 FROM pokemon_sets ps1 WHERE ps1.team_id = t.id AND ps1.species = 'Chien-Pao')
AND EXISTS (SELECT 1 FROM pokemon_sets ps2 WHERE ps2.team_id = t.id AND ps2.species = 'Dragonite')
"""

cursor.execute(query)
rows = cursor.fetchall()
N = len(rows)
threshold = int(0.01 * N) + 1 if 0.01 * N % 1 != 0 else int(0.01 * N)  # round up, but since 24.4, int(24.4)=24, but probably >=25
threshold = 25
print(f"Total teams N: {N}, threshold: {threshold}")

# Dictionaries for each category
single = {}  # pokemon: list of win_rates
double = {}  # frozenset(pair): list of win_rates
trio = {}    # frozenset(trio): list of win_rates
quad = {}    # frozenset(quad): list of win_rates

for partners_str, win_rate in rows:
    if partners_str is None:
        continue
    partners = partners_str.split(',')
    if len(partners) != 4:
        continue  # assuming exactly 4 others
    partners_set = set(partners)
    
    # Single
    for p in partners:
        if p not in single:
            single[p] = []
        single[p].append(win_rate)
    
    # Double
    from itertools import combinations
    for pair in combinations(partners, 2):
        key = frozenset(pair)
        if key not in double:
            double[key] = []
        double[key].append(win_rate)
    
    # Trio
    for tr in combinations(partners, 3):
        key = frozenset(tr)
        if key not in trio:
            trio[key] = []
        trio[key].append(win_rate)
    
    # Quad
    key = frozenset(partners)
    if key not in quad:
        quad[key] = []
    quad[key].append(win_rate)

# Function to get top 10 by avg win_rate desc with count filter
def get_top(category_dict, name_func, threshold):
    items = []
    for key, rates in category_dict.items():
        if rates:
            count = len(rates)
            if count >= threshold:
                avg = statistics.mean(rates)
                items.append((name_func(key), count, avg))
    items.sort(key=lambda x: x[2], reverse=True)
    return items[:10]

# Name funcs
def single_name(p): return p
def pair_name(fs): return '+'.join(sorted(fs))
def trio_name(fs): return '+'.join(sorted(fs))
def quad_name(fs): return '+'.join(sorted(fs))

# Get tops
top_single = get_top(single, single_name, threshold)
top_double = get_top(double, pair_name, threshold)
top_trio = get_top(trio, trio_name, threshold)
top_quad = get_top(quad, quad_name, threshold)

# Print tables
print("### Single Partners")
print("| Partners | Count | Avg Win Rate |")
print("|----------|-------|--------------|")
for p, c, a in top_single:
    print(f"| {p} | {c} | {a:.3f} |")

print("\n### Double Partners")
print("| Partners | Count | Avg Win Rate |")
print("|----------|-------|--------------|")
for p, c, a in top_double:
    print(f"| {p} | {c} | {a:.3f} |")

print("\n### Trios")
print("| Partners | Count | Avg Win Rate |")
print("|----------|-------|--------------|")
for p, c, a in top_trio:
    print(f"| {p} | {c} | {a:.3f} |")

print("\n### Quads")
print("| Partners | Count | Avg Win Rate |")
print("|----------|-------|--------------|")
for p, c, a in top_quad:
    print(f"| {p} | {c} | {a:.3f} |")

conn.close()