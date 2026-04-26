#!/usr/bin/env node

import { Command } from 'commander';
import { DB } from '@vgc/common/database/db';
import { validatePokemon } from '@vgc/common/processors/validate';

interface PokemonSetRow {
  id: number;
  team_id: number;
  species: string;
  item: string | null;
  ability: string | null;
  tera_type: string | null;
  is_mega: number;
  invalid: number;
  format: string;
}

interface MoveRow {
  id: number;
  pokemon_set_id: number;
  move_name: string;
}

const program = new Command();

program
  .name('validate-db')
  .description('Validate pokemon_sets in the DB against @pkmn/dex. Warns on unknown data; --fix applies auto-corrections.')
  .option('--fix', 'Apply auto-corrections to the DB (canonical names, is_mega, invalid flag)')
  .option('--format <code>', 'Only validate teams from this tournament format (e.g. M-A)')
  .option('--tournament <id>', 'Only validate a specific tournament')
  .option('--invalid-only', 'Only show/fix entries currently marked invalid=1')
  .parse(process.argv);

const opts = program.opts<{
  fix: boolean;
  format?: string;
  tournament?: string;
  invalidOnly: boolean;
}>();

const db = new DB();
await db.init();

try {
  // Build the pokemon_sets query with optional filters
  let where = '1=1';
  const params: (string | number)[] = [];

  if (opts.format) {
    where += ' AND tour.format = ?';
    params.push(opts.format);
  }
  if (opts.tournament) {
    where += ' AND tour.id = ?';
    params.push(opts.tournament);
  }
  if (opts.invalidOnly) {
    where += ' AND ps.invalid = 1';
  }

  const sets = db.prepare(`
    SELECT
      ps.id, ps.team_id, ps.species, ps.item, ps.ability, ps.tera_type, ps.is_mega, ps.invalid,
      tour.format
    FROM pokemon_sets ps
    JOIN teams t ON ps.team_id = t.id
    JOIN tournaments tour ON t.tournament_id = tour.id
    WHERE ${where}
    ORDER BY ps.id
  `).all(...params) as PokemonSetRow[];

  if (sets.length === 0) {
    console.log('No pokemon sets matched the filter.');
    process.exit(0);
  }

  // Load all moves for the matched pokemon sets via subquery (avoids IN-list variable limits)
  const allMoves = db.prepare(`
    SELECT m.id, m.pokemon_set_id, m.move_name
    FROM moves m
    JOIN pokemon_sets ps ON m.pokemon_set_id = ps.id
    JOIN teams t ON ps.team_id = t.id
    JOIN tournaments tour ON t.tournament_id = tour.id
    WHERE ${where}
  `).all(...params) as MoveRow[];

  const movesBySetId = new Map<number, MoveRow[]>();
  for (const move of allMoves) {
    const list = movesBySetId.get(move.pokemon_set_id) ?? [];
    list.push(move);
    movesBySetId.set(move.pokemon_set_id, list);
  }

  // Validation pass
  let totalSets = 0;
  let invalidSets = 0;
  let fixedSets = 0;
  let warningCount = 0;
  let fixCount = 0;

  const updateSet = opts.fix ? db.prepare(`
    UPDATE pokemon_sets
    SET species = ?, item = ?, ability = ?, tera_type = ?, is_mega = ?, invalid = ?
    WHERE id = ?
  `) : null;

  const updateMove = opts.fix ? db.prepare(`
    UPDATE moves SET move_name = ? WHERE id = ?
  `) : null;

  for (const row of sets) {
    totalSets++;
    const moves = movesBySetId.get(row.id) ?? [];

    const result = validatePokemon({
      name: row.species,
      item: row.item ?? undefined,
      ability: row.ability ?? undefined,
      tera: row.tera_type ?? undefined,
      attacks: moves.map(m => m.move_name),
    });

    const hadIssues = result.warnings.length > 0 || result.fixes.length > 0;
    if (!hadIssues) continue;

    if (result.invalid) invalidSets++;
    warningCount += result.warnings.length;
    fixCount += result.fixes.length;

    const context = `team_id=${row.team_id} pokemon_id=${row.id}`;

    for (const warning of result.warnings) {
      console.log(`WARN  ${context}: ${warning}`);
    }
    for (const fix of result.fixes) {
      console.log(`FIX   ${context}: ${fix}`);
    }

    if (opts.fix) {
      updateSet!.run(
        result.species,
        result.item,
        result.ability,
        result.tera_type,
        result.is_mega ? 1 : 0,
        result.invalid ? 1 : 0,
        row.id,
      );

      // Update each move by its own ID so we handle reordering correctly
      for (let i = 0; i < moves.length; i++) {
        const canonicalMove = result.moves[i] ?? moves[i].move_name;
        if (canonicalMove !== moves[i].move_name) {
          updateMove!.run(canonicalMove, moves[i].id);
        }
      }

      fixedSets++;
    }
  }

  console.log('');
  console.log(`Checked ${totalSets} pokemon sets`);
  console.log(`  ${invalidSets} with unresolvable fields (invalid=true)`);
  console.log(`  ${warningCount} warnings`);
  console.log(`  ${fixCount} auto-fixable entries`);

  if (opts.fix) {
    console.log(`  ${fixedSets} sets updated in DB`);
  } else if (fixCount > 0) {
    console.log(`  (run with --fix to apply auto-corrections)`);
  }
} finally {
  db.close();
}
