#!/usr/bin/env node

import { Command } from 'commander';
import { DB } from '@vgc/common/database/db';

const program = new Command();

program
  .name('item-winrates')
  .description('Win rate of each held item for a given Pokemon')
  .requiredOption('--pokemon <name>', 'Pokemon species name (required)')
  .option('--format <code>', 'Tournament format code (e.g. M-A, SVF)')
  .option('--min-teams <number>', 'Minimum teams to include an item', '1')
  .action(async (options) => {
    const db = new DB();
    await db.init();

    try {
      const minTeams = parseInt(options.minTeams, 10);
      const hasFormat = !!options.format;

      const rows = db.prepare(`
        SELECT
          COALESCE(NULLIF(ps.item, ''), 'No Item')                    AS item,
          COUNT(DISTINCT t.id)                                         AS teams,
          ROUND(AVG(ts.wins * 1.0 / (ts.wins + ts.losses)) * 100, 1) AS win_rate_pct
        FROM pokemon_sets ps
        JOIN teams t              ON ps.team_id = t.id
        JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id
                                    AND ts.player_id = t.player_id
        JOIN tournaments tour     ON tour.id = t.tournament_id
        WHERE LOWER(ps.species) = LOWER(?)
          AND (${hasFormat ? 'tour.format = ?' : '1'})
          AND ts.wins + ts.losses > 0
        GROUP BY LOWER(ps.item)
        HAVING COUNT(DISTINCT t.id) >= ?
        ORDER BY win_rate_pct DESC
      `).all(
        options.pokemon,
        ...(hasFormat ? [options.format] : []),
        minTeams,
      ) as Array<{ item: string; teams: number; win_rate_pct: number }>;

      if (rows.length === 0) {
        console.log('No data found. Check the pokemon name or format filter.');
        return;
      }

      const label = [
        options.pokemon,
        hasFormat ? `[${options.format}]` : null,
      ].filter(Boolean).join(' ');

      console.log(`\nItem win rates for ${label} (min ${minTeams} teams)\n`);
      console.log('Item'.padEnd(28) + 'Teams'.padStart(8) + '  Win Rate');
      console.log('-'.repeat(48));
      for (const row of rows) {
        console.log(
          row.item.padEnd(28) +
          String(row.teams).padStart(8) +
          `  ${row.win_rate_pct.toFixed(1)}%`,
        );
      }
    } finally {
      db.close();
    }
  });

program.parse();
