#!/usr/bin/env node

import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import { config } from '@vgc/common/config';
import { SupabaseProcessor } from './supabase-processor.js';

const program = new Command();

program
  .name('process')
  .description('Process raw tournament data into structured tables')
  .option('--source <source>', 'Data source (limitless)', 'limitless')
  .option('--tournaments <ids>', 'Comma-separated tournament IDs')
  .option('--force', 'Re-process even if already processed', false)
  .action(async (options) => {
    const supabaseUrl = config.supabaseUrl;
    const supabaseKey = config.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Supabase is required. Set supabase.url and supabase.serviceRoleKey in config.json');
      process.exit(1);
    }
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const processor = new SupabaseProcessor(supabase);

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
  });

program.parse();
