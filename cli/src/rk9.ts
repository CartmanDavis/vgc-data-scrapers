#!/usr/bin/env node

import { Command } from 'commander';
import { RK9Scraper } from '@vgc/common/scrapers/rk9';
import { config } from '@vgc/common/config';
import { SupabaseDataStore } from './db/supabase-db.js';

const program = new Command();

program
  .name('rk9')
  .description('Scrape tournament from RK9.gg')
  .option('--url <url>', 'Tournament URL (required)')
  .option('--delay <seconds>', 'Request delay in seconds', '1.0')
  .action(async (options) => {
    const supabaseUrl = config.supabaseUrl;
    const serviceRoleKey = config.supabaseServiceRoleKey;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Error: Supabase URL and service role key are required. Set supabase.url and supabase.serviceRoleKey in config.json or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.');
      process.exit(1);
    }

    if (!options.url) {
      console.error('Error: --url is required');
      process.exit(1);
    }

    const db = new SupabaseDataStore(supabaseUrl, serviceRoleKey);

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
