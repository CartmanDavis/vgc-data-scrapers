#!/usr/bin/env node

import { Command } from 'commander';
import { DB } from '@vgc/common/database/db';

const program = new Command();

program
  .name('move-winrates')
  .description('Win rate of each move for a given Pokemon (optionally filtered by item)')
  .requiredOption('--pokemon <name>', 'Pokemon species name (required)')
  .option('--item <name>', 'Filter to a specific held item')
  .option('--format <code>', 'Tournament format code (e.g. M-A, SVF)')
  .option('--min-matches <number>', 'Minimum matches to include a move', '1')
  .action(async (options) => {
    const db = new DB();
    await db.init();

    try {
      const minMatches = parseInt(options.minMatches, 10);
      const hasItem = !!options.item;
      const hasFormat = !!options.format;

      const rows = db.prepare(`
        SELECT
          MAX(m.move_name)                                             AS move_name,
          COUNT(DISTINCT t.id)                                         AS teams,
          ROUND(AVG(ts.wins * 1.0 / (ts.wins + ts.losses)) * 100, 1) AS win_rate_pct
        FROM pokemon_sets ps
        JOIN moves m              ON m.pokemon_set_id = ps.id
        JOIN teams t              ON ps.team_id = t.id
        JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id
                                    AND ts.player_id = t.player_id
        JOIN tournaments tour     ON tour.id = t.tournament_id
        WHERE LOWER(ps.species) = LOWER(?)
          AND (${hasItem   ? 'LOWER(ps.item) = LOWER(?)'   : '1'})
          AND (${hasFormat ? 'tour.format = ?'             : '1'})
          AND ts.wins + ts.losses > 0
        GROUP BY LOWER(m.move_name)
        HAVING COUNT(DISTINCT t.id) >= ?
        ORDER BY win_rate_pct DESC
      `).all(
        options.pokemon,
        ...(hasItem   ? [options.item]   : []),
        ...(hasFormat ? [options.format] : []),
        minMatches,
      ) as Array<{ move_name: string; teams: number; win_rate_pct: number }>;

      if (rows.length === 0) {
        console.log('No data found. Check the pokemon name, item, or format filter.');
        return;
      }

      const label = [
        options.pokemon,
        hasItem   ? `@ ${options.item}`        : null,
        hasFormat ? `[${options.format}]`      : null,
      ].filter(Boolean).join(' ');

      console.log(`\nMove win rates for ${label} (min ${minMatches} matches)\n`);
      console.log('Move'.padEnd(24) + 'Teams'.padStart(8) + '  Win Rate');
      console.log('-'.repeat(44));
      for (const row of rows) {
        console.log(
          row.move_name.padEnd(24) +
          String(row.teams).padStart(8) +
          `  ${row.win_rate_pct.toFixed(1)}%`,
        );
      }
    } finally {
      db.close();
    }
  });

program.parse();
