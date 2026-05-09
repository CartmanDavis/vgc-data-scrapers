#!/usr/bin/env node

import { Command } from "commander";
import { LimitlessScraper } from "@vgc/common/scrapers/limitless";
import { config } from "@vgc/common/config";
import { SupabaseDataStore } from "./db/supabase-db.js";

const program = new Command();

program
  .name("limitless")
  .description("Scrape tournaments from Limitless")
  .option("--format <format>", "Format filter (e.g., gen9vgc2026regf)", "M-A")
  .option("--since <date>", "Only scrape after date (YYYY-MM-DD)")
  .option("--api-key <key>", "Override API key")
  .option("--rate-limit <number>", "Rate limit (requests per minute)", "400")
  .option("--id <id>", "Scrape a single tournament by ID")
  .action(async (options) => {
    const supabaseUrl = config.supabaseUrl;
    const serviceRoleKey = config.supabaseServiceRoleKey;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Error: Supabase URL and service role key are required. Set supabase.url and supabase.serviceRoleKey in config.json or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.");
      process.exit(1);
    }

    const apiKey = options.apiKey || config.limitlessApiKey;
    if (!apiKey) {
      console.error(
        "Error: Limitless API key is required. Provide via --api-key or config.json",
      );
      process.exit(1);
    }

    const db = new SupabaseDataStore(supabaseUrl, serviceRoleKey);

    const scraper = new LimitlessScraper(db, {
      apiKey,
      rateLimit: parseInt(options.rateLimit, 10),
    });

    let result;
    if (options.id) {
      result = await scraper.scrapeSingle(options.id);
    } else {
      result = await scraper.scrape({
        format_filter: options.format,
        since: options.since,
      });
    }

    console.log(JSON.stringify(result, null, 2));
    db.close();
    if (!result.success) process.exit(1);
  });

program.parse();
