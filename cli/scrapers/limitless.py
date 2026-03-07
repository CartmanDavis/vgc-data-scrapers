from .base import BaseScraper
from common.api import APIClient
from typing import Dict, Any, List, Optional
from common.logging import setup_logging
from datetime import datetime
import json

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
            
            logger.info("Fetching tournaments", page=current_page, format=format_filter, params=params)
            
            if format_filter and format_filter.lower() in ['svf', 'reg f']:
                params["format"] = format_filter.upper()
            elif format_filter:
                params["format"] = format_filter
            
            tournaments_data = client.get("/tournaments", params=params)
            if isinstance(tournaments_data, dict) and "error" in tournaments_data:
                logger.error("Failed to fetch tournaments", error=str(tournaments_data.get("error")))
                break
            elif not tournaments_data or (isinstance(tournaments_data, list) and len(tournaments_data) == 0):
                logger.info("No tournaments on this page, stopping pagination", page=current_page)
                break

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
            "raw_responses_stored": 0
        }

        for tournament_data in all_tournaments:
            self._scrape_tournament(client, tournament_data, results)

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

    def _raw_data_exists(self, tournament_id: str) -> bool:
        cursor = self.db.conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM limitless_api_raw_data 
            WHERE id = ?
        """, (tournament_id,))
        count = cursor.fetchone()[0]
        return count > 0

    def _store_raw_response(self, tournament_id: str, details: dict, standings: dict, pairings: dict) -> None:
        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO limitless_api_raw_data (id, details, standings, pairings)
            VALUES (?, ?, ?, ?)
        """, (tournament_id, 
              json.dumps(details),
              json.dumps(standings),
              json.dumps(pairings)))
        self.db.conn.commit()

    def _scrape_tournament(self, client: APIClient, tournament_data: Dict[str, Any], results: Dict[str, Any]) -> None:
        tournament_id = tournament_data["id"]

        logger.info("Scraping tournament", id=tournament_id, name=tournament_data.get("name"))

        if self._raw_data_exists(tournament_id):
            logger.info("Raw data already exists, skipping", id=tournament_id)
            return

        details_response = client.get(f"/tournaments/{tournament_id}/details")
        standings_response = client.get(f"/tournaments/{tournament_id}/standings")
        pairings_response = client.get(f"/tournaments/{tournament_id}/pairings")

        if details_response or standings_response or pairings_response:
            self._store_raw_response(
                tournament_id,
                details_response or {},
                standings_response or {},
                pairings_response or {}
            )
            results["raw_responses_stored"] = results.get("raw_responses_stored", 0) + 1

        logger.info("Raw data stored", tournament_id=tournament_id)
