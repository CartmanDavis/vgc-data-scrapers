import initSqlJs, { Database as SqlJsDatabase } from 'sql.js/dist/sql-asm.js';

let db: SqlJsDatabase | null = null;
let initialized = false;

export async function initDB(): Promise<void> {
  if (initialized) return;
  
  const SQL = await initSqlJs();
  
  try {
    const dbPath = '/db/vgc.db';
    const response = await fetch(dbPath);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      db = new SQL.Database(new Uint8Array(buffer));
    } else {
      console.warn('Database file not found at', dbPath, '- creating empty database');
      db = new SQL.Database();
    }
  } catch (err) {
    console.error('Failed to load database:', err);
    db = new SQL.Database();
  }
  
  initialized = true;
}

export function getDB(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

export function runQuery<T>(sql: string, params: unknown[] = []): T[] {
  const database = getDB();
  const stmt = database.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  
  const results: T[] = [];
  while (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const row: Record<string, unknown> = {};
    columns.forEach((col: string, i: number) => {
      row[col] = values[i];
    });
    results.push(row as T);
  }
  stmt.free();
  return results;
}

export function runStatement(sql: string, params: unknown[] = []): void {
  const database = getDB();
  database.run(sql, params as (string | number | null | Uint8Array)[]);
}
