from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import re


class BaseScraper(ABC):
    def __init__(self, db):
        self.db = db

    @abstractmethod
    def scrape(self, **kwargs) -> Dict[str, Any]:
        pass

    def parse_format(self, format_string: str) -> tuple[int, str]:
        format_string = format_string.lower()

        match = re.match(r'gen(\d+)vgc\d{4}([a-z]+)', format_string)
        if match:
            generation = int(match.group(1))
            format_name = match.group(2)
            return generation, format_name

        match = re.match(r'gen(\d+)', format_string)
        if match:
            generation = int(match.group(1))
            format_name = format_string.replace(f'gen{generation}', '').replace('vgc', '')
            return generation, format_name

        limitless_formats = {
            'svf': (9, 'reg f'),
            'svg': (9, 'reg g'),
            'svh': (9, 'reg h'),
            'svi': (9, 'reg i'),
            'sve': (9, 'reg e')
        }

        if format_string in limitless_formats:
            return limitless_formats[format_string]

        return 9, format_string

    def get_or_create_player(self, name: str, country: Optional[str] = None) -> int:
        cursor = self.db.conn.cursor()
        cursor.execute(
            "SELECT id FROM players WHERE name = ?",
            (name,)
        )
        row = cursor.fetchone()

        if row:
            return row[0]

        cursor.execute(
            "INSERT INTO players (name, country) VALUES (?, ?)",
            (name, country)
        )
        self.db.conn.commit()
        return cursor.lastrowid

    def get_or_create_team(self, player_id: int, tournament_id: str) -> int:
        cursor = self.db.conn.cursor()
        cursor.execute(
            "SELECT id FROM teams WHERE player_id = ? AND tournament_id = ?",
            (player_id, tournament_id)
        )
        row = cursor.fetchone()

        if row:
            return row[0]

        cursor.execute(
            "INSERT INTO teams (player_id, tournament_id) VALUES (?, ?)",
            (player_id, tournament_id)
        )
        self.db.conn.commit()
        return cursor.lastrowid

    def tournament_exists(self, tournament_id: str) -> bool:
        cursor = self.db.conn.cursor()
        cursor.execute(
            "SELECT id FROM tournaments WHERE id = ?",
            (tournament_id,)
        )
        return cursor.fetchone() is not None
