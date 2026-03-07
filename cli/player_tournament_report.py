#!/usr/bin/env python3
import sqlite3
import requests
import argparse
from datetime import datetime

def upload_paste(paste, title="", author="", notes=""):
    paste = paste.replace("\n", "\r\n")
    data = {"paste": paste, "title": title, "author": author, "notes": notes}
    try:
        response = requests.post(
            "https://pokepast.es/create", data=data, allow_redirects=True, timeout=30
        )
        if response.status_code == 200:
            return response.url
        else:
            return None
    except:
        return None

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

def get_pokemon_data(cursor, team_id):
    cursor.execute("""
        SELECT
            ps.id, ps.species, ps.form, ps.item, ps.ability, ps.tera_type
        FROM pokemon_sets ps
        WHERE ps.team_id = ?
        ORDER BY ps.id LIMIT 6
    """, (team_id,))

    pokemon_sets = cursor.fetchall()
    team_pokemon = []
    for ps_id, species, form, item, ability, tera_type in pokemon_sets:
        cursor.execute("SELECT move_name FROM moves WHERE pokemon_set_id = ? ORDER BY id", (ps_id,))
        moves = [row[0] for row in cursor.fetchall()]
        team_pokemon.append({
            'species': species, 'form': form, 'item': item,
            'ability': ability, 'tera_type': tera_type, 'moves': moves
        })
    return team_pokemon

def main():
    parser = argparse.ArgumentParser(
        description="Generate a tournament report for a player including pastes"
    )
    parser.add_argument("player_name", help="Player name to look up")
    parser.add_argument(
        "--days", type=int, default=90,
        help="Number of days to look back (default: 90)"
    )
    parser.add_argument(
        "--db", default="/Users/carterdavis/Development/vgc/usage-stats/db/vgc.db",
        help="Path to database"
    )

    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    cursor.execute("SELECT id, name FROM players WHERE name LIKE ?", (f"%{args.player_name}%",))
    players = cursor.fetchall()

    if not players:
        print(f"No player found matching: {args.player_name}")
        return

    if len(players) > 1:
        print(f"Multiple players found:")
        for pid, pname in players:
            print(f"  - {pname} (id: {pid})")
        return

    player_id, player_name = players[0]
    print(f"Generating report for: {player_name} (id: {player_id})\n")

    cursor.execute("""
        SELECT t.id, t.name, t.date, ts.wins, ts.losses, ts.team_id
        FROM tournament_standings ts
        JOIN tournaments t ON ts.tournament_id = t.id
        WHERE ts.player_id = ? AND t.date >= date('now', ?)
        ORDER BY t.date DESC
    """, (player_id, f"-{args.days} days"))

    tournaments = cursor.fetchall()

    if not tournaments:
        print(f"No tournaments found for {player_name} in the last {args.days} days")
        return

    output = []
    seen_pastes = {}

    for tournament_id, tournament_name, date, wins, losses, team_id in tournaments:
        print(f"Processing: {tournament_name[:40]}...")

        tournament_link = f"https://play.limitlesstcg.com/tournament/{tournament_id}/standings"

        team_pokemon = get_pokemon_data(cursor, team_id)
        player_paste = create_paste(team_id, team_pokemon)
        player_url = upload_paste(player_paste, title=f"{player_name} - {tournament_name}", author=player_name)
        seen_pastes[team_id] = player_url

        cursor.execute("""
            SELECT m.round_number, p.name, CASE WHEN mp.score > opp_mp.score THEN 'W' WHEN mp.score < opp_mp.score THEN 'L' ELSE 'T' END,
                   opp_mp.team_id, opp_mp.score
            FROM matches m
            JOIN match_participants mp ON m.id = mp.match_id AND mp.player_id = ?
            JOIN match_participants opp_mp ON m.id = opp_mp.match_id AND opp_mp.player_id != ?
            JOIN players p ON opp_mp.player_id = p.id
            WHERE m.tournament_id = ?
            ORDER BY m.round_number
        """, (player_id, player_id, tournament_id))

        match_results = cursor.fetchall()

        date_obj = datetime.fromisoformat(date.replace('T', ' ')[:19])
        date_str = date_obj.strftime("%b %d, %Y")

        output.append(f"## [{tournament_name}]({tournament_link})")
        output.append(date_str)
        if player_url:
            output.append(player_url)
        else:
            output.append("(upload failed)")
        output.append(f"{wins} - {losses}")

        seen_teams = set()
        for round_num, opponent_name, result, opponent_team_id, opp_score in match_results:
            if opponent_team_id in seen_teams:
                continue
            seen_teams.add(opponent_team_id)

            if opponent_team_id in seen_pastes:
                opp_url = seen_pastes[opponent_team_id]
            else:
                opp_pokemon = get_pokemon_data(cursor, opponent_team_id)
                opp_paste = create_paste(opponent_team_id, opp_pokemon)
                opp_url = upload_paste(opp_paste, title=f"{opponent_name} - {tournament_name}", author=opponent_name)
                seen_pastes[opponent_team_id] = opp_url

            if opp_url:
                output.append(f"* {result} - {opp_url}")
            else:
                output.append(f"* {result} - (upload failed)")

        output.append("")

    conn.close()

    print("\n" + "="*80)
    for line in output:
        print(line)

if __name__ == "__main__":
    main()
