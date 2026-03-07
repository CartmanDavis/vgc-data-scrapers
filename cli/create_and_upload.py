import sqlite3
import requests
from collections import defaultdict
import sys

def upload_paste(paste, title="", author="", notes=""):
    paste = paste.replace("\n", "\r\n")
    data = {"paste": paste, "title": title, "author": author, "notes": notes}
    response = requests.post(
        "https://pokepast.es/create", data=data, allow_redirects=True
    )
    return response.url

def create_paste(team_id, pokemon_data):
    paste = ""
    for pokemon in pokemon_data:
        name = pokemon['species']
        if pokemon['form']:
            name = f"{name}-{pokemon['form']}"
        if pokemon['item']:
            paste += f"{name} @ {pokemon['item']}\n"
        else:
            paste += f"{name}\n"
        
        if pokemon['ability']:
            paste += f"Ability: {pokemon['ability']}\n"
        if pokemon['tera_type']:
            paste += f"Tera Type: {pokemon['tera_type']}\n"
        
        for move in pokemon['moves']:
            paste += f"- {move}\n"
        
        paste += "\n"
    
    return paste.strip()

if len(sys.argv) < 2:
    print("Usage: python create_and_upload.py <player_id> [format]")
    sys.exit(1)

player_id = int(sys.argv[1])
format_filter = sys.argv[2] if len(sys.argv) > 2 else None

# Connect to database
conn = sqlite3.connect('/Users/carterdavis/Development/vgc/usage-stats/db/vgc.db')
cursor = conn.cursor()

# Get player name
cursor.execute("SELECT name FROM players WHERE id = ?", (player_id,))
player_name = cursor.fetchone()[0]

# Get team data
query = """
    SELECT 
        t.id as tournament_id,
        t.name as tournament_name,
        t.date,
        mp.team_id
    FROM match_participants mp
    JOIN matches m ON mp.match_id = m.id
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE mp.player_id = ?
"""
params = [player_id]
if format_filter:
    query += " AND t.format = ?"
    params.append(format_filter)
query += " GROUP BY t.id, mp.team_id ORDER BY t.date DESC, t.id;"

cursor.execute(query, params)

teams_data = cursor.fetchall()

for tournament_id, tournament_name, date, team_id in teams_data:
    # Get Pokemon for this team (just one set per team)
    cursor.execute("""
        SELECT 
            ps.id,
            ps.species,
            ps.form,
            ps.item,
            ps.ability,
            ps.tera_type
        FROM pokemon_sets ps
        WHERE ps.team_id = ?
        ORDER BY ps.id
        LIMIT 6
    """, (team_id,))
    
    pokemon_sets = cursor.fetchall()
    
    # Get Pokemon species for opponents
    cursor.execute("""
        SELECT DISTINCT opp_mp.team_id
        FROM match_participants mp
        JOIN matches m ON mp.match_id = m.id
        JOIN match_participants opp_mp ON mp.match_id = opp_mp.match_id AND opp_mp.player_id != mp.player_id
        WHERE mp.player_id = ?
          AND mp.team_id = ?
          AND m.tournament_id = ?
    """, (player_id, team_id, tournament_id))
    
    opponent_team_ids = [row[0] for row in cursor.fetchall()]
    
    # Get match results
    cursor.execute("""
        SELECT 
            m.round_number,
            opp_mp.team_id as opponent_team_id,
            CASE 
                WHEN mp.score > opp_mp.score THEN 'W'
                WHEN mp.score < opp_mp.score THEN 'L'
                ELSE 'T'
            END as result
        FROM match_participants mp
        JOIN matches m ON mp.match_id = m.id
        JOIN match_participants opp_mp ON mp.match_id = opp_mp.match_id AND opp_mp.player_id != mp.player_id
        WHERE mp.player_id = ?
          AND mp.team_id = ?
          AND m.tournament_id = ?
        GROUP BY m.round_number, opp_mp.team_id
        ORDER BY m.round_number
    """, (player_id, team_id, tournament_id))
    
    match_results = cursor.fetchall()
    
    # Create opponent team map
    opponent_teams = {}
    for opp_team_id in opponent_team_ids:
        cursor.execute("""
            SELECT ps.species, ps.form
            FROM pokemon_sets ps
            WHERE ps.team_id = ?
            GROUP BY ps.species, ps.form
            ORDER BY ps.id
            LIMIT 6
        """, (opp_team_id,))
        
        species_list = cursor.fetchall()
        team_name = ", ".join([f"{sp[0]} {sp[1]}" if sp[1] else sp[0] for sp in species_list])
        opponent_teams[opp_team_id] = team_name
    
    # Get moves for team Pokemon
    team_pokemon = []
    for ps_id, species, form, item, ability, tera_type in pokemon_sets:
        cursor.execute("""
            SELECT move_name
            FROM moves
            WHERE pokemon_set_id = ?
            ORDER BY id
        """, (ps_id,))
        
        moves = [row[0] for row in cursor.fetchall()]
        
        team_pokemon.append({
            'species': species,
            'form': form,
            'item': item,
            'ability': ability,
            'tera_type': tera_type,
            'moves': moves
        })
    
    # Create paste
    paste_content = create_paste(team_id, team_pokemon)
    
    # Upload to pokepast.es
    url = upload_paste(paste_content, title=tournament_name, author=player_name)
    
    # Format date
    from datetime import datetime
    date_obj = datetime.fromisoformat(date.replace('T', ' ')[:19])
    date_str = date_obj.strftime("%b %d, %Y")
    
    # Calculate W/L record
    wins = sum(1 for _, _, result in match_results if result == 'W')
    losses = sum(1 for _, _, result in match_results if result == 'L')
    
    print(f"{tournament_name} ({date_str})")
    print(f"{wins} W - {losses} L")
    print(url)
    
    # Print opponent results
    for round_num, opp_team_id, result in match_results:
        if opp_team_id in opponent_teams:
            print(f"- {result}: {opponent_teams[opp_team_id]}")
    
    print()

conn.close()
