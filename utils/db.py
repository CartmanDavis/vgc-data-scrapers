import sqlite3
from pathlib import Path
from typing import Optional


class Database:
    def __init__(self, db_path: str = "./db/vgc.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        cursor = self.conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tournaments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                date DATETIME NOT NULL,
                location TEXT,
                generation INTEGER NOT NULL,
                format TEXT NOT NULL,
                official BOOLEAN NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                country TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id INTEGER NOT NULL,
                tournament_id TEXT NOT NULL,
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
                UNIQUE(player_id, tournament_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pokemon_sets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_id INTEGER NOT NULL,
                species TEXT NOT NULL,
                form TEXT,
                item TEXT,
                ability TEXT,
                tera_type TEXT,
                FOREIGN KEY (team_id) REFERENCES teams(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_set_id INTEGER NOT NULL,
                move_name TEXT NOT NULL,
                FOREIGN KEY (pokemon_set_id) REFERENCES pokemon_sets(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tournament_id TEXT NOT NULL,
                round_number INTEGER NOT NULL,
                table_number INTEGER,
                FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS match_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id INTEGER NOT NULL,
                player_id INTEGER NOT NULL,
                team_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                FOREIGN KEY (match_id) REFERENCES matches(id),
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (team_id) REFERENCES teams(id),
                UNIQUE(match_id, player_id)
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tournaments_generation_format ON tournaments(generation, format)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_teams_tournament ON teams(tournament_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pokemon_sets_team ON pokemon_sets(team_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id)
        """)

        self.conn.commit()

    def close(self):
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
