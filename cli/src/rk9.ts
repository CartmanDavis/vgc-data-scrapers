#!/usr/bin/env node

import { Command } from 'commander';
import { RK9Scraper } from '@vgc/common/scrapers/rk9';
import { DB } from '@vgc/common/database/db';
import { config } from '@vgc/common/config';

const program = new Command();

program
  .name('rk9')
  .description('Scrape tournament from RK9.gg')
  .option('--url <url>', 'Tournament URL (required)')
  .option('--delay <seconds>', 'Request delay in seconds', '1.0')
  .action(async (options) => {
    const db = new DB();
    await db.init();

    if (!options.url) {
      console.error('Error: --url is required');
      process.exit(1);
    }

    const scraper = new RK9Scraper(db, {
      requestDelay: parseFloat(options.delay) || config.rk9RequestDelay,
    });

    const result = await scraper.scrape({
      url: options.url,
    });

    console.log(JSON.stringify(result, null, 2));
    db.close();
  });

program.parse();
