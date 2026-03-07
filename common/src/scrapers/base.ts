import { DB } from '../database/db.js';

export interface ParseFormatResult {
  generation: number;
  format: string;
}

export abstract class BaseScraper {
  protected db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  abstract scrape(params: Record<string, unknown>): Promise<Record<string, unknown>>;

  parseFormat(formatString: string): ParseFormatResult {
    formatString = formatString.toLowerCase();

    let match = formatString.match(/gen(\d+)vgc\d{4}([a-z]+)/);
    if (match) {
      const generation = parseInt(match[1], 10);
      const format = match[2];
      return { generation, format };
    }

    match = formatString.match(/gen(\d+)/);
    if (match) {
      const generation = parseInt(match[1], 10);
      const format = formatString.replace(`gen${generation}`, '').replace('vgc', '');
      return { generation, format };
    }

    const limitlessFormats: Record<string, [number, string]> = {
      'svf': [9, 'reg f'],
      'svg': [9, 'reg g'],
      'svh': [9, 'reg h'],
      'svi': [9, 'reg i'],
      'sve': [9, 'reg e'],
    };

    if (formatString in limitlessFormats) {
      return { generation: limitlessFormats[formatString][0], format: limitlessFormats[formatString][1] };
    }

    return { generation: 9, format: formatString };
  }

  getOrCreatePlayer(name: string, country?: string): number {
    const existing = this.db.prepare('SELECT id FROM players WHERE name = ?').get(name) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }

    const result = this.db.prepare('INSERT INTO players (name, country) VALUES (?, ?)').run(name, country ?? null);
    return result.lastInsertRowid as number;
  }

  getOrCreateTeam(playerId: number, tournamentId: string): number {
    const existing = this.db.prepare('SELECT id FROM teams WHERE player_id = ? AND tournament_id = ?').get(playerId, tournamentId) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }

    const result = this.db.prepare('INSERT INTO teams (player_id, tournament_id) VALUES (?, ?)').run(playerId, tournamentId);
    return result.lastInsertRowid as number;
  }

  tournamentExists(tournamentId: string): boolean {
    const result = this.db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tournamentId);
    return result !== undefined;
  }
}
