#!/usr/bin/env node

import { Command } from 'commander';
import { LimitlessScraper } from '@vgc/common/scrapers/limitless';
import { config } from '@vgc/common/config';
import { createClient } from '@supabase/supabase-js';

const program = new Command();

program
  .name('limitless')
  .description('Scrape tournaments from Limitless')
  .option('--format <format>', 'Format filter (e.g., gen9vgc2026regf)', 'M-A')
  .option('--since <date>', 'Only scrape after date (YYYY-MM-DD)')
  .option('--api-key <key>', 'Override API key')
  .option('--rate-limit <number>', 'Rate limit (requests per minute)', '400')
  .option('--id <id>', 'Scrape a single tournament by ID')
  .action(async (options) => {
    const supabaseUrl = config.supabaseUrl;
    const supabaseKey = config.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Supabase is required. Set supabase.url and supabase.serviceRoleKey in config.json');
      process.exit(1);
    }
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const apiKey = options.apiKey || config.limitlessApiKey;
    if (!apiKey) {
      console.error('Error: Limitless API key is required. Provide via --api-key or config.json');
      process.exit(1);
    }

    const scraper = new LimitlessScraper({
      apiKey,
      rateLimit: parseInt(options.rateLimit, 10),
    });

    let result;

    if (options.id) {
      result = await scraper.scrapeSingle(options.id);
    } else {
      // Compute default since from last tournament in Supabase
      let since = options.since;
      if (!since) {
        const { data } = await supabase
          .from('tournaments')
          .select('date')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.date) {
          const d = new Date(data.date);
          d.setDate(d.getDate() - 1);
          since = d.toISOString().split('T')[0];
          console.log(`Defaulting --since to ${since} (day before last tournament)`);
        }
      }

      // Fetch existing IDs to skip
      const { data: existingRaw } = await supabase
        .from('limitless_api_raw_data')
        .select('id');
      const skipIds = new Set((existingRaw ?? []).map((r: { id: string }) => r.id));

      result = await scraper.scrape({
        format_filter: options.format,
        since,
        skipIds,
      });
    }

    // Store fetched raw data to Supabase
    if (result.rawDataFetched.length > 0) {
      console.log(`Storing ${result.rawDataFetched.length} tournament(s) to Supabase...`);
      for (const raw of result.rawDataFetched) {
        const details = raw.details as Record<string, unknown>;

        // Upsert tournament stub first (FK requirement: limitless_api_raw_data.id → tournaments.id)
        const { error: tournamentError } = await supabase.from('tournaments').upsert({
          id: raw.id,
          name: (details.name as string) || raw.id,
          date: (details.date as string) || new Date().toISOString(),
          location: null,
          generation: 9,
          format: (details.format as string) || '',
          official: false,
        });
        if (tournamentError) {
          console.error(`Failed to upsert tournament stub for ${raw.id}:`, tournamentError.message);
          continue;
        }

        // Upsert raw data (Supabase JSONB accepts objects directly)
        const { error: rawError } = await supabase.from('limitless_api_raw_data').upsert({
          id: raw.id,
          details: raw.details,
          standings: raw.standings,
          pairings: raw.pairings,
        });
        if (rawError) {
          console.error(`Failed to upsert raw data for ${raw.id}:`, rawError.message);
          continue;
        }

        console.log(`Stored: ${raw.id}`);
      }
      console.log('Done.');
    } else {
      console.log('No new tournaments to store.');
    }

    console.log(JSON.stringify({ ...result, rawDataFetched: result.rawDataFetched.map(r => r.id) }, null, 2));
  });

program.parse();
