#!/usr/bin/env node

import { DB } from '@vgc/common/database/db';

function toTitleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map(word =>
      word.split('-').map(part =>
        part.length === 0 ? '' : part[0].toUpperCase() + part.slice(1).toLowerCase()
      ).join('-')
    )
    .join(' ');
}

function normalizeField(db: DB, table: string, column: string): number {
  const rows = db.prepare(
    `SELECT DISTINCT ${column} FROM ${table} WHERE ${column} IS NOT NULL`
  ).all() as Record<string, string>[];

  let changed = 0;
  for (const row of rows) {
    const original = row[column];
    const corrected = toTitleCase(original);
    if (original !== corrected) {
      db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(corrected, original);
      console.log(`  ${JSON.stringify(original)} → ${JSON.stringify(corrected)}`);
      changed++;
    }
  }
  return changed;
}

const db = new DB();
await db.init();

try {
  // Add is_mega column if it doesn't exist yet
  try {
    db.prepare('ALTER TABLE pokemon_sets ADD COLUMN is_mega INTEGER NOT NULL DEFAULT 0').run();
    console.log('Added is_mega column to pokemon_sets\n');
  } catch {
    // Column already exists
  }

  // --- Normalize capitalization & trim whitespace ---

  console.log('=== Species ===');
  const speciesChanged = normalizeField(db, 'pokemon_sets', 'species');
  console.log(`${speciesChanged} unique values updated\n`);

  console.log('=== Items ===');
  const itemsChanged = normalizeField(db, 'pokemon_sets', 'item');
  console.log(`${itemsChanged} unique values updated\n`);

  console.log('=== Abilities ===');
  const abilitiesChanged = normalizeField(db, 'pokemon_sets', 'ability');
  console.log(`${abilitiesChanged} unique values updated\n`);

  console.log('=== Tera Types ===');
  const teraChanged = normalizeField(db, 'pokemon_sets', 'tera_type');
  console.log(`${teraChanged} unique values updated\n`);

  console.log('=== Moves ===');
  const movesChanged = normalizeField(db, 'moves', 'move_name');
  console.log(`${movesChanged} unique values updated\n`);

  // --- Strip "Mega " prefix from species names ---
  // Done unconditionally: a species stored as "Mega Charizard Y" should be "Charizard",
  // stripping both the "Mega " prefix and any trailing X/Y/Z form letter.
  // is_mega (below) is set based on the item held, not the species name.

  console.log('=== Mega species name fix ===');
  const megaSpecies = db.prepare(
    `SELECT DISTINCT species FROM pokemon_sets WHERE species LIKE 'Mega %'`
  ).all() as { species: string }[];

  for (const { species } of megaSpecies) {
    let fixed = species.slice(5); // remove "Mega " (5 chars)
    // Strip trailing form letter from X/Y/Z mega variants (e.g. "Charizard Y" → "Charizard")
    if (/^.+ [XYZ]$/.test(fixed)) {
      fixed = fixed.slice(0, -2);
    }
    db.prepare(`UPDATE pokemon_sets SET species = ? WHERE species = ?`).run(fixed, species);
    console.log(`  "${species}" → "${fixed}"`);
  }
  console.log(`${megaSpecies.length} species names updated\n`);

  // --- Detect mega pokemon via held item and set is_mega ---
  // (Run before the X/Y/Z suffix pass so is_mega is populated)

  db.prepare('UPDATE pokemon_sets SET is_mega = 0').run();
  db.prepare(`
    UPDATE pokemon_sets SET is_mega = 1
    WHERE (
      item LIKE '%ite'
      OR item LIKE '%ite X'
      OR item LIKE '%ite Y'
      OR item LIKE '%ite Z'
    )
    AND item != 'Eviolite'
  `).run();

  const megaCount = (db.prepare(
    'SELECT COUNT(*) AS cnt FROM pokemon_sets WHERE is_mega = 1'
  ).get() as { cnt: number }).cnt;

  console.log(`=== is_mega ===`);
  console.log(`${megaCount} pokemon_sets marked is_mega = 1\n`);

  // --- Strip leftover X/Y/Z form suffixes from mega species ---
  // Catches cases like "Charizard Y" left by a prior clean run before this fix was added.
  console.log('=== Mega form suffix fix (X/Y/Z) ===');
  const xyzSpecies = db.prepare(`
    SELECT DISTINCT species FROM pokemon_sets
    WHERE is_mega = 1 AND (species LIKE '% X' OR species LIKE '% Y' OR species LIKE '% Z')
  `).all() as { species: string }[];
  for (const { species } of xyzSpecies) {
    const fixed = species.slice(0, -2);
    db.prepare('UPDATE pokemon_sets SET species = ? WHERE species = ?').run(fixed, species);
    console.log(`  "${species}" → "${fixed}"`);
  }
  console.log(`${xyzSpecies.length} species names updated\n`);

  console.log('Done. Saving database...');
} finally {
  db.close();
}
