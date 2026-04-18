#!/usr/bin/env node

import { Command } from 'commander';
import { DataProcessor } from '@vgc/common/processors/processor';
import { DB } from './db/db.js';

const program = new Command();

program
  .name('process')
  .description('Process raw tournament data into structured tables')
  .option('--source <source>', 'Data source (limitless, rk9)', 'limitless')
  .option('--tournaments <ids>', 'Comma-separated tournament IDs')
  .option('--force', 'Re-process even if already processed', false)
  .action(async (options) => {
    const db = new DB();
    db.init();

    const processor = new DataProcessor(db);

    let tournamentIds: string[] | undefined;
    if (options.tournaments) {
      tournamentIds = options.tournaments.split(',').map((t: string) => t.trim());
    }

    const result = await processor.processTournaments({
      source: options.source,
      tournamentIds,
      force: options.force,
    });

    console.log(JSON.stringify(result, null, 2));
    db.close();
  });

program.parse();
