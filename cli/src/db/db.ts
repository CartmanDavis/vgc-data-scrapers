import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../..');

export class DB {
  public db!: Database.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = resolve(PROJECT_ROOT, 'db/vgc.db');
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  init(): void {
    this.db = new Database(this.dbPath);
    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date DATETIME NOT NULL,
        location TEXT,
        generation INTEGER NOT NULL,
        format TEXT NOT NULL,
        official BOOLEAN NOT NULL
      );

      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        country TEXT
      );

      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        tournament_id TEXT NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
        UNIQUE(player_id, tournament_id)
      );

      CREATE TABLE IF NOT EXISTS pokemon_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        species TEXT NOT NULL,
        form TEXT,
        item TEXT,
        ability TEXT,
        tera_type TEXT,
        FOREIGN KEY (team_id) REFERENCES teams(id)
      );

      CREATE TABLE IF NOT EXISTS moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pokemon_set_id INTEGER NOT NULL,
        move_name TEXT NOT NULL,
        FOREIGN KEY (pokemon_set_id) REFERENCES pokemon_sets(id)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        table_number INTEGER,
        phase INTEGER,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
      );

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
      );

      CREATE TABLE IF NOT EXISTS tournament_standings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id TEXT NOT NULL,
        player_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        placing INTEGER,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        ties INTEGER NOT NULL DEFAULT 0,
        dropped BOOLEAN DEFAULT 0,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        UNIQUE(tournament_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS limitless_api_raw_data (
        id TEXT PRIMARY KEY,
        details TEXT,
        standings TEXT,
        pairings TEXT,
        UNIQUE(id),
        FOREIGN KEY (id) REFERENCES tournaments(id) ON DELETE CASCADE
      );
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tournaments_generation_format ON tournaments(generation, format);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_teams_tournament ON teams(tournament_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_pokemon_sets_team ON pokemon_sets(team_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tournament_standings_tournament ON tournament_standings(tournament_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tournament_standings_player ON tournament_standings(player_id);`);
  }

  close(): void {
    this.db.close();
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql);
  }
}

export class Statement {
  private db: Database.Database;
  private sql: string;

  constructor(db: Database.Database, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  run(...params: unknown[]): RunResult {
    const stmt = this.db.prepare(this.sql);
    const result = stmt.run(...params as (string | number | null | Uint8Array)[]);
    return {
      lastInsertRowid: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }

  get(...params: unknown[]): unknown {
    const stmt = this.db.prepare(this.sql);
    return stmt.get(...params as (string | number | null | Uint8Array)[]) as unknown;
  }

  all(...params: unknown[]): unknown[] {
    const stmt = this.db.prepare(this.sql);
    return stmt.all(...params as (string | number | null | Uint8Array)[]) as unknown[];
  }
}

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}
