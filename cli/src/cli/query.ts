#!/usr/bin/env node

import { Command } from 'commander';
import { DB } from '../database/db.js';

const program = new Command();

program
  .name('query')
  .description('Query the database')
  .option('--tournaments', 'List tournaments')
  .option('--players', 'List players')
  .option('--teams', 'List teams')
  .option('--sql <query>', 'Custom SQL query')
  .option('--limit <number>', 'Limit results', '10')
  .action(async (options) => {
    const db = new DB();
    await db.init();
    const limit = parseInt(options.limit, 10);

    try {
      if (options.tournaments) {
        const rows = db.prepare(`
          SELECT id, name, date, location, generation, format, official
          FROM tournaments
          ORDER BY date DESC
          LIMIT ?
        `).all(limit);

        console.log('Tournaments:');
        console.log(JSON.stringify(rows, null, 2));
      } else if (options.players) {
        const rows = db.prepare(`
          SELECT id, name, country
          FROM players
          ORDER BY name
          LIMIT ?
        `).all(limit);

        console.log('Players:');
        console.log(JSON.stringify(rows, null, 2));
      } else if (options.teams) {
        const rows = db.prepare(`
          SELECT t.id, t.player_id, t.tournament_id, p.name as player_name
          FROM teams t
          JOIN players p ON t.player_id = p.id
          LIMIT ?
        `).all(limit);

        console.log('Teams:');
        console.log(JSON.stringify(rows, null, 2));
      } else if (options.sql) {
        const rows = db.prepare(options.sql).all();
        console.log(JSON.stringify(rows, null, 2));
      } else {
        console.log('Please specify --tournaments, --players, --teams, or --sql');
        program.help();
      }
    } finally {
      db.close();
    }
  });

program.parse();
