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

  // --- Detect mega pokemon via held item and set is_mega ---

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

  console.log('Done. Saving database...');
} finally {
  db.close();
}
