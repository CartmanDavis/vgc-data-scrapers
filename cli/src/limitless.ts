#!/usr/bin/env node

import { Command } from "commander";
import { LimitlessScraper } from "@vgc/common/scrapers/limitless";
import { DB } from "@vgc/common/database/db";
import { config } from "@vgc/common/config";

const program = new Command();

program
  .name("limitless")
  .description("Scrape tournaments from Limitless")
  .option("--format <format>", "Format filter (e.g., gen9vgc2026regf)")
  .option("--since <date>", "Only scrape after date (YYYY-MM-DD)")
  .option("--api-key <key>", "Override API key")
  .option("--rate-limit <number>", "Rate limit (requests per minute)", "400")
  .option("--id <id>", "Scrape a single tournament by ID")
  .action(async (options) => {
    const db = new DB();
    await db.init();

    const apiKey = options.apiKey || config.limitlessApiKey;
    if (!apiKey) {
      console.error(
        "Error: Limitless API key is required. Provide via --api-key or config.json",
      );
      process.exit(1);
    }

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
  });

program.parse();
