#!/usr/bin/env node

import { Command } from 'commander';
import { DataProcessor } from '@vgc/common/processors/processor';
import { config } from '@vgc/common/config';
import { SupabaseDataStore } from './db/supabase-db.js';

const program = new Command();

program
  .name('process')
  .description('Process raw tournament data into structured tables')
  .option('--source <source>', 'Data source (limitless)', 'limitless')
  .option('--tournaments <ids>', 'Comma-separated tournament IDs')
  .option('--force', 'Re-process even if already processed', false)
  .action(async (options) => {
    const supabaseUrl = config.supabaseUrl;
    const serviceRoleKey = config.supabaseServiceRoleKey;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Error: Supabase URL and service role key are required. Set supabase.url and supabase.serviceRoleKey in config.json or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.');
      process.exit(1);
    }

    const db = new SupabaseDataStore(supabaseUrl, serviceRoleKey);
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

    if (result.success && (result.errors as string[]).length === 0) {
      const { error: refreshErr } = await db.supabase.rpc('refresh_materialized_views');
      if (refreshErr) console.warn('Warning: failed to refresh materialized views:', refreshErr.message);
      else console.log('Materialized views refreshed.');
    }

    db.close();
    if (!result.success || (result.errors as string[]).length > 0) process.exit(1);
  });

program.parse();
