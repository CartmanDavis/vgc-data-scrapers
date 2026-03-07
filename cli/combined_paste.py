import sqlite3
import requests
from collections import defaultdict
from datetime import datetime

def upload_paste(paste, title="", author="", notes=""):
    paste = paste.replace("\n", "\r\n")
    data = {"paste": paste, "title": title, "author": author, "notes": notes}
    response = requests.post(
        "https://pokepast.es/create", data=data, allow_redirects=True
    )
    return response.url

def create_paste(team_id, pokemon_data, tournament_name, date_str, wins, losses):
    paste = f"{tournament_name} ({date_str}) - {wins}W-{losses}L\n\n"
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
    
    return paste.strip() + "\n\n"

# Connect to database
conn = sqlite3.connect('/Users/carterdavis/Development/vgc/usage-stats/db/vgc.db')
cursor = conn.cursor()

# Get team data for RadialVGC's SVF teams
cursor.execute("""
    SELECT 
        t.id as tournament_id,
        t.name as tournament_name,
        t.date,
        mp.team_id
    FROM match_participants mp
    JOIN matches m ON mp.match_id = m.id
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE mp.player_id = 3315
      AND t.format = 'SVF'
      AND t.id != '660c1150bd59c305cfa7eaf6'
    GROUP BY t.id, mp.team_id
    ORDER BY t.date, t.id;
""")

teams_data = cursor.fetchall()

all_pastes = ""

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
    
    # Get match results
    cursor.execute("""
        SELECT 
            CASE 
                WHEN mp.score > opp_mp.score THEN 'W'
                WHEN mp.score < opp_mp.score THEN 'L'
                ELSE 'T'
            END as result
        FROM match_participants mp
        JOIN matches m ON mp.match_id = m.id
        JOIN match_participants opp_mp ON mp.match_id = opp_mp.match_id AND opp_mp.player_id != mp.player_id
        WHERE mp.player_id = 3315
          AND mp.team_id = ?
          AND m.tournament_id = ?
        GROUP BY m.round_number, opp_mp.team_id
        ORDER BY m.round_number
    """, (team_id, tournament_id))
    
    match_results = cursor.fetchall()
    
    # Calculate W/L record
    wins = sum(1 for result in match_results if result[0] == 'W')
    losses = sum(1 for result in match_results if result[0] == 'L')
    
    # Format date
    date_obj = datetime.fromisoformat(date.replace('T', ' ')[:19])
    date_str = date_obj.strftime("%b %d, %Y")
    
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
    
    # Create paste for this team
    team_paste = create_paste(team_id, team_pokemon, tournament_name, date_str, wins, losses)
    all_pastes += team_paste

# Upload the combined paste
url = upload_paste(all_pastes, title="RadialVGC Reg F Teams", author="RadialVGC")

print(url)