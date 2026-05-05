#!/usr/bin/env node

import { Command } from 'commander';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@vgc/common/config';
import axios from 'axios';

const STATS_BASE = 'https://www.smogon.com/stats';
const FORMAT = 'gen9championsvgc2026regma';
const ELO_CUTOFFS = [0, 1500, 1630, 1760];

interface UsageRow {
  month: string;
  format: string;
  elo_cutoff: number;
  rank: number;
  species: string;
  usage_pct: number;
  raw_count: number;
  total_battles: number;
}

function parseStatsFile(text: string, month: string, elo: number): UsageRow[] {
  const lines = text.split('\n');
  let totalBattles = 0;

  const battlesMatch = lines[0]?.match(/Total battles:\s*(\d+)/);
  if (battlesMatch) totalBattles = parseInt(battlesMatch[1], 10);

  const rows: UsageRow[] = [];
  for (const line of lines) {
    // Match data rows: | rank | species | usage% | raw | ...
    const m = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|/);
    if (!m) continue;
    rows.push({
      month,
      format: FORMAT,
      elo_cutoff: elo,
      rank: parseInt(m[1], 10),
      species: m[2].trim(),
      usage_pct: parseFloat(m[3]),
      raw_count: parseInt(m[4], 10),
      total_battles: totalBattles,
    });
  }
  return rows;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await axios.get<string>(url, { responseType: 'text', timeout: 15000 });
    return res.data;
  } catch {
    return null;
  }
}

async function getAvailableMonths(): Promise<string[]> {
  const html = await fetchText(STATS_BASE + '/');
  if (!html) throw new Error('Could not fetch Smogon stats index');
  const months = [...html.matchAll(/href="(20\d{2}-\d{2})\/"/g)].map(m => m[1]);
  return [...new Set(months)].sort();
}

async function getStoredMonths(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase
    .from('ps_usage_stats')
    .select('month')
    .eq('format', FORMAT);
  return new Set((data ?? []).map((r: { month: string }) => r.month));
}

const program = new Command();

program
  .name('showdown')
  .description('Fetch Pokemon Showdown usage stats for the M-A format')
  .option('--month <YYYY-MM>', 'Fetch a specific month instead of auto-detecting new ones')
  .action(async (options) => {
    const supabaseUrl = config.supabaseUrl;
    const supabaseKey = config.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Supabase is required. Set supabase.url and supabase.serviceRoleKey in config.json');
      process.exit(1);
    }
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    let monthsToFetch: string[];

    if (options.month) {
      monthsToFetch = [options.month];
    } else {
      console.log('Fetching available months from Smogon...');
      const allMonths = await getAvailableMonths();
      const stored = await getStoredMonths(supabase);
      monthsToFetch = allMonths.filter(m => !stored.has(m));
      console.log(`${allMonths.length} months available, ${stored.size} already stored, ${monthsToFetch.length} to fetch`);
    }

    let totalRows = 0;
    let monthsStored = 0;

    for (const month of monthsToFetch) {
      const allRows: UsageRow[] = [];

      for (const elo of ELO_CUTOFFS) {
        const url = `${STATS_BASE}/${month}/${FORMAT}-${elo}.txt`;
        const text = await fetchText(url);
        if (!text) {
          // Format doesn't exist for this month/elo — skip the whole month
          break;
        }
        const rows = parseStatsFile(text, month, elo);
        if (rows.length === 0) break;
        allRows.push(...rows);
        console.log(`  ${month} elo=${elo}: ${rows.length} species`);
      }

      if (allRows.length === 0) {
        console.log(`  ${month}: format not found, skipping`);
        continue;
      }

      // Upsert in batches of 500
      const BATCH = 500;
      for (let i = 0; i < allRows.length; i += BATCH) {
        const batch = allRows.slice(i, i + BATCH);
        const { error } = await supabase
          .from('ps_usage_stats')
          .upsert(batch, { onConflict: 'month,format,elo_cutoff,species' });
        if (error) throw new Error(`Upsert failed for ${month}: ${error.message}`);
      }

      totalRows += allRows.length;
      monthsStored++;
      console.log(`Stored ${month}: ${allRows.length} rows`);
    }

    console.log(JSON.stringify({ success: true, monthsStored, totalRows }, null, 2));
  });

program.parse();
