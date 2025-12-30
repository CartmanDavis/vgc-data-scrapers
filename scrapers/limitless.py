from scrapers.base import BaseScraper
from utils.api import APIClient
from typing import Dict, Any, List, Optional
from utils.logging import setup_logging
from datetime import datetime

logger = setup_logging()


class LimitlessScraper(BaseScraper):
    def __init__(self, db, api_key: str, rate_limit: int = 200):
        super().__init__(db)
        self.api_key = api_key
        self.base_url = "https://play.limitlesstcg.com/api"
        self.rate_limit = rate_limit

    def scrape(self, **kwargs) -> Dict[str, Any]:
        format_filter = kwargs.get('format_filter')
        limit = kwargs.get('limit')
        since_date = kwargs.get('since')
        page = kwargs.get('page', 1)
        all_pages = kwargs.get('all_pages', False)

        if not self.api_key:
            logger.error("Limitless API key not provided")
            return {"success": False, "error": "API key required"}

        client = APIClient(
            base_url=self.base_url,
            headers={"X-Access-Key": self.api_key},
            rate_limit=self.rate_limit
        )

        all_tournaments = []
        current_page = page

        while True:
            params = {}
            if format_filter:
                params["format"] = format_filter
            params["page"] = current_page

            tournaments_data = client.get("/tournaments", params=params)
            if not tournaments_data:
                logger.error("Failed to fetch tournaments")
                return {"success": False, "error": "Failed to fetch tournaments"}

            tournaments = tournaments_data if isinstance(tournaments_data, list) else tournaments_data.get("data", [])

            if len(tournaments) == 0:
                logger.info("No tournaments on this page, stopping pagination", page=current_page)
                break

            all_tournaments.extend(tournaments)
            logger.info("Fetched tournaments", page=current_page, count=len(tournaments))

            if len(tournaments) < 50:
                logger.info("End of pagination (fewer than 50 tournaments)", page=current_page)
                break

            current_page += 1

        logger.info("Total tournaments fetched", total=len(all_tournaments))

        if since_date:
            all_tournaments = self._filter_by_date(all_tournaments, since_date)
            logger.info("Filtered tournaments by date", since=since_date, count=len(all_tournaments))

        if limit:
            all_tournaments = all_tournaments[:limit]

        logger.info("Found tournaments", count=len(all_tournaments))

        results = {
            "success": True,
            "tournaments_scraped": 0,
            "players_scraped": 0,
            "teams_scraped": 0,
            "matches_scraped": 0
        }

        for tournament_data in all_tournaments:
            if self.tournament_exists(tournament_data["id"]):
                logger.info("Tournament already exists, skipping", id=tournament_data["id"])
                continue

            self._scrape_tournament(client, tournament_data, results)
            results["tournaments_scraped"] += 1

        return results

    def _filter_by_date(self, tournaments: List[Dict[str, Any]], since_date: str) -> List[Dict[str, Any]]:
        try:
            since_dt = datetime.strptime(since_date, "%Y-%m-%d")

            filtered = []
            for tournament in tournaments:
                tournament_date_str = tournament.get("date")
                if tournament_date_str:
                    try:
                        tournament_dt = datetime.strptime(tournament_date_str, "%Y-%m-%d")
                        if tournament_dt > since_dt:
                            filtered.append(tournament)
                    except ValueError:
                        pass

            return filtered

        except ValueError:
            logger.error("Invalid since date format. Use YYYY-MM-DD", since=since_date)
            return tournaments

    def _scrape_tournament(self, client: APIClient, tournament_data: Dict[str, Any], results: Dict[str, Any]):
        tournament_id = tournament_data["id"]

        logger.info("Scraping tournament", id=tournament_id, name=tournament_data.get("name"))

        generation, format_name = self.parse_format(tournament_data.get("format", ""))

        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO tournaments (id, name, date, location, generation, format, official)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            tournament_id,
            tournament_data.get("name"),
            tournament_data.get("date"),
            tournament_data.get("location"),
            generation,
            format_name,
            False
        ))
        self.db.conn.commit()

        standings_data = client.get(f"/tournaments/{tournament_id}/standings")
        if standings_data:
            standings_list = standings_data if isinstance(standings_data, list) else standings_data.get("data", [])
            logger.info("Processing standings", count=len(standings_list))
            self._process_standings(standings_list, tournament_id)

        pairings_data = client.get(f"/tournaments/{tournament_id}/pairings")
        logger.info("Pairings API response", data_type=type(pairings_data), has_data=bool(pairings_data))
        
        if pairings_data:
            pairings_list = pairings_data if isinstance(pairings_data, list) else pairings_data.get("data", [])
            players_in_matches, teams_in_matches, matches_in_tournament = self._process_pairings(pairings_list, tournament_id)

            results["players_scraped"] = len(players_in_matches)
            results["teams_scraped"] = len(teams_in_matches)
            results["matches_scraped"] = len(matches_in_tournament)

            results["players_scraped"] = len(players_in_matches)
            results["teams_scraped"] = len(teams_in_matches)
            results["matches_scraped"] = len(matches_in_tournament)

    def _process_standings(self, standings: List[Dict[str, Any]], tournament_id: str):
        cursor = self.db.conn.cursor()

        players_in_this_tournament = set()

        for entry in standings:
            player_id = self.get_or_create_player(
                entry.get("name"),
                entry.get("country")
            )

            team_id = self.get_or_create_team(player_id, tournament_id)

            if player_id not in players_in_this_tournament:
                players_in_this_tournament.add(player_id)

                decklist = entry.get("decklist", [])
                for pokemon in decklist:
                    pokemon_set_id = self._create_pokemon_set(
                        team_id,
                        pokemon.get("name"),
                        pokemon.get("item"),
                        pokemon.get("ability"),
                        pokemon.get("tera")
                    )

                    attacks = pokemon.get("attacks", [])
                    for attack in attacks:
                        self._create_move(pokemon_set_id, attack)

            logger.debug("Processed player", player_id=player_id, team_id=team_id, pokemon_count=len(decklist))

    def _process_pairings(self, pairings: List[Dict[str, Any]], tournament_id: str) -> set:
        cursor = self.db.conn.cursor()

        players_in_matches = set()
        teams_in_matches = set()
        matches_in_tournament = set()

        for pairing in pairings:
            round_num = pairing.get("round")
            table_num = pairing.get("table")

            cursor.execute("""
                INSERT INTO matches (tournament_id, round_number, table_number)
                VALUES (?, ?, ?)
            """, (tournament_id, round_num, table_num))
            match_id = cursor.lastrowid
            matches_in_tournament.add(match_id)

            player1_name = self._get_player_name(pairing.get("player1Id"))
            player2_name = self._get_player_name(pairing.get("player2Id"))

            result = pairing.get("result", "")

            player1_score, player2_score = self._parse_result(result)

            if player1_name:
                player1_id = self.get_or_create_player(player1_name)
                if player1_id not in players_in_matches:
                    players_in_matches.add(player1_id)

                team1_id = self.get_or_create_team(player1_id, tournament_id)
                if team1_id not in teams_in_matches:
                    teams_in_matches.add(team1_id)

                cursor.execute("""
                    INSERT INTO match_participants (match_id, player_id, team_id, score)
                    VALUES (?, ?, ?, ?)
                """, (match_id, player1_id, team1_id, player1_score))

            if player2_name:
                player2_id = self.get_or_create_player(player2_name)
                if player2_id not in players_in_matches:
                    players_in_matches.add(player2_id)

                team2_id = self.get_or_create_team(player2_id, tournament_id)
                if team2_id not in teams_in_matches:
                    teams_in_matches.add(team2_id)

                cursor.execute("""
                    INSERT INTO match_participants (match_id, player_id, team_id, score)
                    VALUES (?, ?, ?, ?)
                """, (match_id, player2_id, team2_id, player2_score))

        return players_in_matches, teams_in_matches, matches_in_tournament

        self.db.conn.commit()

    def _get_player_name(self, player_id: Optional[str]) -> Optional[str]:
        if not player_id:
            return None

        cursor = self.db.conn.cursor()
        cursor.execute("SELECT name FROM players WHERE id = ?", (int(player_id[1:]),))
        row = cursor.fetchone()
        return row[0] if row else None

    def _create_pokemon_set(self, team_id: int, name: str, item: str, ability: str, tera_type: str) -> int:
        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO pokemon_sets (team_id, species, item, ability, tera_type)
            VALUES (?, ?, ?, ?, ?)
        """, (team_id, name, item, ability, tera_type))
        self.db.conn.commit()
        return cursor.lastrowid

    def _create_move(self, pokemon_set_id: int, move_name: str):
        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO moves (pokemon_set_id, move_name)
            VALUES (?, ?)
        """, (pokemon_set_id, move_name))
        self.db.conn.commit()

    def _parse_result(self, result: str) -> tuple[int, int]:
        if not result:
            return 0, 0

        parts = result.split("-")
        if len(parts) == 2:
            try:
                return int(parts[0]), int(parts[1])
            except ValueError:
                pass

        return 0, 0
