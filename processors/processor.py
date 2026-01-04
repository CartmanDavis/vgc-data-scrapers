import json
from typing import Dict, Any, List, Optional, Set
from common.logging import setup_logging
import sqlite3

logger = setup_logging()


class DataProcessor:
    def __init__(self, db):
        self.db = db

    def process_tournaments(self, source: str = 'limitless', tournament_ids: Optional[List[str]] = None, force: bool = False) -> Dict[str, Any]:
        """Process raw tournament data into structured tables."""
        
        results = {
            "success": True,
            "tournaments_processed": 0,
            "players_added": 0,
            "teams_added": 0,
            "pokemon_sets_added": 0,
            "matches_added": 0,
            "tournament_standings_added": 0,
            "errors": []
        }

        cursor = self.db.conn.cursor()

        if source == 'limitless':
            query = "SELECT id, details, standings, pairings FROM limitless_api_raw_data"
            params = []
            
            if tournament_ids:
                placeholders = ','.join('?' * len(tournament_ids))
                query += f" WHERE id IN ({placeholders})"
                params = tournament_ids
        else:
            results["success"] = False
            results["errors"].append(f"Unsupported source: {source}")
            return results

        cursor.execute(query, params)
        raw_data_rows = cursor.fetchall()

        logger.info("Found raw tournaments", count=len(raw_data_rows))

        for row in raw_data_rows:
            tournament_id = row[0]
            details_json = row[1]
            standings_json = row[2]
            pairings_json = row[3]

            try:
                if not details_json or not standings_json or not pairings_json:
                    logger.warning("Incomplete data for tournament", id=tournament_id)
                    continue

                details = json.loads(details_json)
                standings = json.loads(standings_json)
                pairings = json.loads(pairings_json)

                if not force:
                    if self._is_processed(tournament_id):
                        logger.info("Tournament already processed, skipping", id=tournament_id)
                        continue

                self._process_tournament(tournament_id, details, standings, pairings, results)
                results["tournaments_processed"] += 1
                
                logger.info("Processed tournament", id=tournament_id)

            except Exception as e:
                error_msg = f"Failed to process tournament {tournament_id}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                results["errors"].append(error_msg)

        self.db.conn.commit()
        return results

    def _is_processed(self, tournament_id: str) -> bool:
        cursor = self.db.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM tournaments WHERE id = ?", (tournament_id,))
        return cursor.fetchone()[0] > 0

    def _process_tournament(self, tournament_id: str, details: Dict[str, Any], standings: List[Dict[str, Any]], pairings: List[Dict[str, Any]], results: Dict[str, Any]) -> None:
        """Process a single tournament's data."""
        
        cursor = self.db.conn.cursor()

        tournament_name = details.get('name', '')
        tournament_date = details.get('date', '')
        location = None
        generation = 9
        format_val = details.get('format', '')
        official = 0

        cursor.execute("""
            INSERT OR REPLACE INTO tournaments (id, name, date, location, generation, format, official)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (tournament_id, tournament_name, tournament_date, location, generation, format_val, official))

        player_names_to_ids = {}

        for standing in standings:
            player_name = standing.get('name', '')
            country = standing.get('country')

            if not player_name:
                continue

            player_id = self._get_or_create_player(cursor, player_name, country)
            player_names_to_ids[player_name.lower()] = player_id

            team_id = self._get_or_create_team(cursor, player_id, tournament_id)

            placing = standing.get('placing')
            record = standing.get('record', {})
            wins = record.get('wins', 0)
            losses = record.get('losses', 0)
            ties = record.get('ties', 0)
            dropped = 1 if standing.get('drop') else 0

            cursor.execute("""
                INSERT OR REPLACE INTO tournament_standings (tournament_id, player_id, team_id, placing, wins, losses, ties, dropped)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (tournament_id, player_id, team_id, placing, wins, losses, ties, dropped))
            results["tournament_standings_added"] += 1

            results["players_added"] += 1
            results["teams_added"] += 1

            decklist = standing.get('decklist', [])
            for pokemon in decklist:
                pokemon_id = pokemon.get('id', pokemon.get('name', ''))
                pokemon_name = pokemon.get('name', '')
                item = pokemon.get('item')
                ability = pokemon.get('ability')
                tera_type = pokemon.get('tera')
                attacks = pokemon.get('attacks', [])

                pokemon_set_id = self._create_pokemon_set(cursor, team_id, pokemon_name, item, ability, tera_type)
                results["pokemon_sets_added"] += 1

                for move in attacks:
                    cursor.execute("""
                        INSERT INTO moves (pokemon_set_id, move_name)
                        VALUES (?, ?)
                    """, (pokemon_set_id, move))

        for pairing in pairings:
            round_number = pairing.get('round', 0)
            phase = pairing.get('phase', 1)
            table_number = pairing.get('table')

            cursor.execute("""
                INSERT INTO matches (tournament_id, round_number, table_number, phase)
                VALUES (?, ?, ?, ?)
            """, (tournament_id, round_number, table_number, phase))
            match_id = cursor.lastrowid
            results["matches_added"] += 1

            player1_name = pairing.get('player1')
            player2_name = pairing.get('player2')
            winner = pairing.get('winner')

            if player1_name:
                player1_id = player_names_to_ids.get(player1_name.lower())
                if player1_id:
                    team1_id = self._get_team_id(cursor, player1_id, tournament_id)
                    if team1_id:
                        score1 = 1 if winner == player1_name else 0
                        cursor.execute("""
                            INSERT OR REPLACE INTO match_participants (match_id, player_id, team_id, score)
                            VALUES (?, ?, ?, ?)
                        """, (match_id, player1_id, team1_id, score1))

            if player2_name:
                player2_id = player_names_to_ids.get(player2_name.lower())
                if player2_id:
                    team2_id = self._get_team_id(cursor, player2_id, tournament_id)
                    if team2_id:
                        score2 = 1 if winner == player2_name else 0
                        cursor.execute("""
                            INSERT OR REPLACE INTO match_participants (match_id, player_id, team_id, score)
                            VALUES (?, ?, ?, ?)
                        """, (match_id, player2_id, team2_id, score2))

    def _get_or_create_player(self, cursor, name: str, country: Optional[str] = None) -> int:
        cursor.execute("SELECT id FROM players WHERE name = ?", (name,))
        row = cursor.fetchone()
        
        if row:
            return row[0]
        
        cursor.execute("""
            INSERT INTO players (name, country)
            VALUES (?, ?)
        """, (name, country))
        return cursor.lastrowid

    def _get_or_create_team(self, cursor, player_id: int, tournament_id: str) -> int:
        cursor.execute("""
            SELECT id FROM teams 
            WHERE player_id = ? AND tournament_id = ?
        """, (player_id, tournament_id))
        row = cursor.fetchone()
        
        if row:
            return row[0]
        
        cursor.execute("""
            INSERT INTO teams (player_id, tournament_id)
            VALUES (?, ?)
        """, (player_id, tournament_id))
        return cursor.lastrowid

    def _get_team_id(self, cursor, player_id: int, tournament_id: str) -> Optional[int]:
        cursor.execute("""
            SELECT id FROM teams 
            WHERE player_id = ? AND tournament_id = ?
        """, (player_id, tournament_id))
        row = cursor.fetchone()
        return row[0] if row else None

    def _create_pokemon_set(self, cursor, team_id: int, species: str, item: Optional[str], ability: Optional[str], tera_type: Optional[str]) -> int:
        cursor.execute("""
            INSERT INTO pokemon_sets (team_id, species, item, ability, tera_type)
            VALUES (?, ?, ?, ?, ?)
        """, (team_id, species, item, ability, tera_type))
        return cursor.lastrowid
