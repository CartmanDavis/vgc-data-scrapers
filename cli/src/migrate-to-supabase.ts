#!/usr/bin/env node
// One-time migration: copies M-A format data from local SQLite into Supabase.
// Requires supabase.serviceRoleKey in config.json and supabase.url (or defaults).
// Run: pnpm --filter @vgc/cli run migrate-to-supabase

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Config } from '@vgc/common/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const FORMAT = 'M-A';
const BATCH = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function insertBatched(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return;
  let inserted = 0;
  for (const batch of chunk(rows, BATCH)) {
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
  }
  console.log();
}

async function main() {
  const config = new Config();
  const supabaseUrl = config.supabaseUrl;
  const serviceRoleKey = config.supabaseServiceRoleKey;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing supabase.url or supabase.serviceRoleKey in config.json');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const sqlite = new Database(resolve(PROJECT_ROOT, 'db/vgc.db'), { readonly: true });
  console.log(`Migrating format=${FORMAT} data from SQLite → Supabase\n`);

  // ── 1. Tournaments ────────────────────────────────────────────────────────
  console.log('tournaments...');
  const tournaments = sqlite.prepare(
    `SELECT * FROM tournaments WHERE format = ?`
  ).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'tournaments', tournaments.map(t => ({
    id:         t.id,
    name:       t.name,
    date:       t.date,
    location:   t.location ?? null,
    generation: t.generation,
    format:     t.format,
    official:   Boolean(t.official),
  })));


  // ── 2. Players ────────────────────────────────────────────────────────────
  console.log('players...');
  const players = sqlite.prepare(`
    SELECT DISTINCT p.*
    FROM players p
    JOIN teams t    ON t.player_id     = p.id
    JOIN tournaments tour ON tour.id   = t.tournament_id
    WHERE tour.format = ?
  `).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'players', players.map(p => ({
    id:      p.id,
    name:    p.name,
    country: p.country ?? null,
  })));

  // ── 3. Teams ──────────────────────────────────────────────────────────────
  console.log('teams...');
  const teams = sqlite.prepare(`
    SELECT t.*
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    WHERE tour.format = ?
  `).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'teams', teams.map(t => ({
    id:            t.id,
    player_id:     t.player_id,
    tournament_id: t.tournament_id,
  })));


  // ── 4. Pokemon sets ───────────────────────────────────────────────────────
  console.log('pokemon_sets...');
  const pokemonSets = sqlite.prepare(`
    SELECT ps.*
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    WHERE tour.format = ?
  `).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'pokemon_sets', pokemonSets.map(ps => ({
    id:        ps.id,
    team_id:   ps.team_id,
    species:   ps.species,
    form:      ps.form ?? null,
    item:      ps.item ?? null,
    ability:   ps.ability ?? null,
    tera_type: ps.tera_type ?? null,
    is_mega:   Boolean(ps.is_mega),
    invalid:   Boolean(ps.invalid),
  })));


  // ── 5. Moves ──────────────────────────────────────────────────────────────
  console.log('moves...');
  const moves = sqlite.prepare(`
    SELECT m.*
    FROM moves m
    JOIN pokemon_sets ps ON ps.id = m.pokemon_set_id
    JOIN teams t ON t.id = ps.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    WHERE tour.format = ?
  `).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'moves', moves.map(m => ({
    id:             m.id,
    pokemon_set_id: m.pokemon_set_id,
    move_name:      m.move_name,
  })));

  // ── 6. Matches ────────────────────────────────────────────────────────────
  console.log('matches...');
  const matches = sqlite.prepare(`
    SELECT m.*
    FROM matches m
    JOIN tournaments tour ON tour.id = m.tournament_id
    WHERE tour.format = ?
  `).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'matches', matches.map(m => ({
    id:            m.id,
    tournament_id: m.tournament_id,
    round_number:  m.round_number,
    table_number:  m.table_number ?? null,
    phase:         m.phase ?? null,
  })));

  // ── 7. Match participants ─────────────────────────────────────────────────
  console.log('match_participants...');
  const matchParticipants = sqlite.prepare(`
    SELECT mp.*
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    JOIN tournaments tour ON tour.id = m.tournament_id
    WHERE tour.format = ?
  `).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'match_participants', matchParticipants.map(mp => ({
    id:        mp.id,
    match_id:  mp.match_id,
    player_id: mp.player_id,
    team_id:   mp.team_id,
    score:     mp.score,
  })));

  // ── 8. Tournament standings ───────────────────────────────────────────────
  console.log('tournament_standings...');
  const standings = sqlite.prepare(`
    SELECT ts.*
    FROM tournament_standings ts
    JOIN tournaments tour ON tour.id = ts.tournament_id
    WHERE tour.format = ?
  `).all(FORMAT) as Record<string, unknown>[];

  await insertBatched(supabase, 'tournament_standings', standings.map(ts => ({
    id:            ts.id,
    tournament_id: ts.tournament_id,
    player_id:     ts.player_id,
    team_id:       ts.team_id,
    placing:   ts.placing ?? null,
    wins:          ts.wins,
    losses:        ts.losses,
    ties:          ts.ties,
    dropped:       Boolean(ts.dropped),
  })));

  sqlite.close();

  console.log('\nDone! Run this in the Supabase SQL editor to reset sequences:\n');
  for (const table of ['players','teams','pokemon_sets','moves','matches','match_participants','tournament_standings']) {
    console.log(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), MAX(id)) FROM ${table};`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
