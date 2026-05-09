import type { IDataStore } from '../database/interfaces.js';

export interface ParseFormatResult {
  generation: number;
  format: string;
}

export abstract class BaseScraper {
  protected db: IDataStore;

  constructor(db: IDataStore) {
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

  async getOrCreatePlayer(name: string, country?: string): Promise<number> {
    return this.db.findOrCreatePlayer(name, country);
  }

  async getOrCreateTeam(playerId: number, tournamentId: string): Promise<number> {
    return this.db.findOrCreateTeam(playerId, tournamentId);
  }

  async tournamentExists(tournamentId: string): Promise<boolean> {
    return this.db.tournamentExists(tournamentId);
  }
}
