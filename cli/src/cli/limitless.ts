#!/usr/bin/env node

import { Command } from 'commander';
import { LimitlessScraper } from '../scrapers/limitless.js';
import { DB } from '../database/db.js';
import { config } from '@vgc/common/config.js';

const program = new Command();

program
  .name('limitless')
  .description('Scrape tournaments from Limitless')
  .option('--format <format>', 'Format filter (e.g., gen9vgc2026regf)')
  .option('--limit <number>', 'Maximum tournaments to scrape', '50')
  .option('--since <date>', 'Only scrape after date (YYYY-MM-DD)')
  .option('--page <number>', 'Starting page number', '1')
  .option('--api-key <key>', 'Override API key')
  .option('--rate-limit <number>', 'Rate limit (requests per minute)', '200')
  .option('--db-path <path>', 'Database path', './db/vgc.db')
  .action(async (options) => {
    const dbPath = options.dbPath || config.dbPath;
    const db = new DB(dbPath);

    const apiKey = options.apiKey || config.limitlessApiKey;
    if (!apiKey) {
      console.error('Error: Limitless API key is required. Provide via --api-key or config.json');
      process.exit(1);
    }

    const scraper = new LimitlessScraper(db, {
      apiKey,
      rateLimit: parseInt(options.rateLimit, 10),
    });

    const result = await scraper.scrape({
      format_filter: options.format,
      limit: parseInt(options.limit, 10),
      since: options.since,
      page: parseInt(options.page, 10),
    });

    console.log(JSON.stringify(result, null, 2));
    db.close();
  });

program.parse();
