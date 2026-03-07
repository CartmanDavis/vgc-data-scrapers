import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../..');

export class DB {
  public db!: SqlJsDatabase;
  private dbPath: string;
  private SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

  constructor() {
    this.dbPath = resolve(PROJECT_ROOT, 'db/vgc.db');
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  async init(): Promise<void> {
    this.SQL = await initSqlJs();
    try {
      const { readFileSync } = await import('fs');
      if (existsSync(this.dbPath)) {
        const buffer = readFileSync(this.dbPath);
        this.db = new this.SQL.Database(buffer);
      } else {
        this.db = new this.SQL.Database();
      }
    } catch {
      this.db = new this.SQL.Database();
    }
    this.createTables();
  }

  private createTables(): void {
    this.db.run(`
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

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tournaments_generation_format ON tournaments(generation, format);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_teams_tournament ON teams(tournament_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_pokemon_sets_team ON pokemon_sets(team_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tournament_standings_tournament ON tournament_standings(tournament_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tournament_standings_player ON tournament_standings(player_id);`);
  }

  close(): void {
    this.save();
    this.db.close();
  }

  save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql);
  }
}

export class Statement {
  private db: SqlJsDatabase;
  private sql: string;

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  run(...params: unknown[]): RunResult {
    this.db.run(this.sql, params as (string | number | null | Uint8Array)[]);
    const lastId = this.db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] as number | undefined;
    return {
      lastInsertRowid: lastId ?? 0,
      changes: this.db.getRowsModified(),
    };
  }

  get(...params: unknown[]): unknown {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    if (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();
      const result: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        result[col] = values[i];
      });
      return result;
    }
    stmt.free();
    return undefined;
  }

  all(...params: unknown[]): unknown[] {
    const results: unknown[] = [];
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    while (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      const row: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      results.push(row);
    }
    stmt.free();
    return results;
  }
}

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

export const db = new DB();
