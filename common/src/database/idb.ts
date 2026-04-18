export interface IDB {
  prepare(sql: string): IStatement;
  close(): void;
}

export interface IStatement {
  run(...params: unknown[]): IRunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface IRunResult {
  lastInsertRowid: number;
  changes: number;
}
