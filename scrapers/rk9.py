from .base import BaseScraper
from bs4 import BeautifulSoup
import time
import requests
from typing import Dict, Any, List, Optional
from common.logging import setup_logging

logger = setup_logging()


class RK9Scraper(BaseScraper):
    def __init__(self, db, request_delay: float = 1.0):
        super().__init__(db)
        self.request_delay = request_delay
        self.base_url = "https://rk9.gg"

    def scrape(self, **kwargs) -> Dict[str, Any]:
        tournament_url = kwargs.get('url')
        if not tournament_url:
            logger.error("RK9 tournament URL not provided")
            return {"success": False, "error": "URL required"}

        self._wait_for_rate_limit()

        try:
            logger.info("Scraping RK9 tournament", url=tournament_url)

            tournament_data = self._scrape_tournament_page(tournament_url)
            if not tournament_data:
                logger.error("Failed to scrape tournament page")
                return {"success": False, "error": "Failed to scrape tournament page"}

            tournament_id = tournament_data.get("id") or self._generate_tournament_id(tournament_url)

            if self.tournament_exists(tournament_id):
                logger.info("Tournament already exists, skipping", id=tournament_id)
                return {"success": True, "skipped": True, "tournament_id": tournament_id}

            self._save_tournament(tournament_id, tournament_data)

            roster_url = tournament_url.rstrip('/') + "/roster/"
            self._wait_for_rate_limit()
            self._scrape_roster(roster_url, tournament_id)

            pairings_url = tournament_url.rstrip('/') + "/pairings/"
            self._wait_for_rate_limit()
            self._scrape_pairings(pairings_url, tournament_id)

            logger.info("Successfully scraped RK9 tournament", id=tournament_id)

            return {
                "success": True,
                "tournament_id": tournament_id
            }

        except Exception as e:
            logger.error("Error scraping RK9 tournament", error=str(e), url=tournament_url)
            return {"success": False, "error": str(e)}

    def _wait_for_rate_limit(self):
        time.sleep(self.request_delay)

    def _generate_tournament_id(self, url: str) -> str:
        return f"rk9-{url.rstrip('/').split('/')[-1]}"

    def _scrape_tournament_page(self, url: str) -> Optional[Dict[str, Any]]:
        try:
            response = requests.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')

            name = None
            date = None
            location = None
            format_str = "reg f"

            name_elem = soup.find('h1')
            if name_elem:
                name = name_elem.get_text(strip=True)

            date_elem = soup.find(string=lambda text: 'Date:' in text)
            if date_elem:
                date_text = date_elem.parent.get_text(strip=True).replace('Date:', '').strip()
                date = self._parse_date(date_text)

            location_elem = soup.find(string=lambda text: 'Location:' in text)
            if location_elem:
                location = location_elem.parent.get_text(strip=True).replace('Location:', '').strip()

            if not name:
                return None

            generation, format_name = self.parse_format(format_str)

            return {
                "name": name,
                "date": date,
                "location": location,
                "generation": generation,
                "format": format_name
            }

        except Exception as e:
            logger.error("Error parsing tournament page", error=str(e), url=url)
            return None

    def _scrape_roster(self, url: str, tournament_id: str):
        try:
            response = requests.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')

            player_entries = soup.find_all('div', class_=lambda x: x and 'player' in x.lower())

            for entry in player_entries:
                player_name = None
                country = None
                pokemon_list = []

                name_elem = entry.find(class_=lambda x: x and 'name' in x.lower())
                if name_elem:
                    name_text = name_elem.get_text(strip=True)
                    if '(' in name_text and ')' in name_text:
                        parts = name_text.rsplit('(', 1)
                        player_name = parts[0].strip()
                        country = parts[1].rstrip(')').strip()
                    else:
                        player_name = name_text

                pokemon_elems = entry.find_all(class_=lambda x: x and 'pokemon' in x.lower() or 'poke' in x.lower())
                for poke_elem in pokemon_elems:
                    pokemon_name = poke_elem.get_text(strip=True)
                    if pokemon_name:
                        pokemon_list.append(pokemon_name)

                if player_name:
                    player_id = self.get_or_create_player(player_name, country)
                    team_id = self.get_or_create_team(player_id, tournament_id)

                    for pokemon in pokemon_list:
                        self._save_pokemon_set(team_id, pokemon)

                    logger.debug("Saved player team", player=player_name, pokemon_count=len(pokemon_list))

        except Exception as e:
            logger.error("Error parsing roster", error=str(e), url=url)

    def _scrape_pairings(self, url: str, tournament_id: str):
        try:
            response = requests.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')

            round_elems = soup.find_all('div', class_=lambda x: x and 'round' in x.lower())

            cursor = self.db.conn.cursor()

            for round_elem in round_elems:
                round_text = round_elem.get_text(strip=True)
                round_num = self._extract_round_number(round_text)

                matchups = round_elem.find_all('div', class_=lambda x: x and 'match' in x.lower() or 'pair' in x.lower())

                for matchup in matchups:
                    players = matchup.find_all(class_=lambda x: x and 'player' in x.lower() or 'name' in x.lower())

                    if len(players) >= 2:
                        player1_name = players[0].get_text(strip=True)
                        player2_name = players[1].get_text(strip=True)

                        cursor.execute("""
                            INSERT INTO matches (tournament_id, round_number, table_number)
                            VALUES (?, ?, ?)
                        """, (tournament_id, round_num, None))
                        match_id = cursor.lastrowid

                        player1_id = self.get_or_create_player(player1_name)
                        team1_id = self.get_or_create_team(player1_id, tournament_id)

                        player2_id = self.get_or_create_player(player2_name)
                        team2_id = self.get_or_create_team(player2_id, tournament_id)

                        cursor.execute("""
                            INSERT INTO match_participants (match_id, player_id, team_id, score)
                            VALUES (?, ?, ?, ?)
                        """, (match_id, player1_id, team1_id, 0))

                        cursor.execute("""
                            INSERT INTO match_participants (match_id, player_id, team_id, score)
                            VALUES (?, ?, ?, ?)
                        """, (match_id, player2_id, team2_id, 0))

            self.db.conn.commit()
            logger.debug("Saved pairings", tournament_id=tournament_id)

        except Exception as e:
            logger.error("Error parsing pairings", error=str(e), url=url)

    def _save_tournament(self, tournament_id: str, data: Dict[str, Any]):
        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO tournaments (id, name, date, location, generation, format, official)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            tournament_id,
            data.get("name"),
            data.get("date"),
            data.get("location"),
            data.get("generation"),
            data.get("format"),
            True
        ))
        self.db.conn.commit()

    def _save_pokemon_set(self, team_id: int, pokemon_name: str):
        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO pokemon_sets (team_id, species)
            VALUES (?, ?)
        """, (team_id, pokemon_name))
        self.db.conn.commit()

    def _parse_date(self, date_str: str) -> Optional[str]:
        return date_str

    def _extract_round_number(self, round_text: str) -> int:
        import re
        match = re.search(r'\d+', round_text)
        if match:
            return int(match.group())
        return 1
