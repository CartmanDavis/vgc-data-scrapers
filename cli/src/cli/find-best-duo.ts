#!/usr/bin/env node

import { DB } from '../database/db.js';

const db = new DB();
await db.init();

const query = `
SELECT t.id,
       (SELECT GROUP_CONCAT(ps.species) FROM pokemon_sets ps WHERE ps.team_id = t.id) AS pokemon_list,
       (ts.wins * 1.0 / (ts.wins + ts.losses)) AS win_rate
FROM teams t
JOIN tournaments tour ON t.tournament_id = tour.id
JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
WHERE tour.format = 'SVF'
AND ts.wins + ts.losses > 0
`;

const rows = db.prepare(query).all() as Array<{ id: number; pokemon_list: string | null; win_rate: number }>;
const N = rows.length;
console.log(`Total teams: ${N}`);

const pairs: Record<string, number[]> = {};

function combinations<T>(arr: T[], r: number): T[][] {
  if (r === 0) return [[]];
  if (arr.length === 0) return [];
  const first = arr[0];
  const rest = arr.slice(1);
  const combsWithoutFirst = combinations(rest, r - 1).map(c => [first, ...c]);
  const combsWithOutFirst = combinations(rest, r);
  return [...combsWithoutFirst, ...combsWithOutFirst];
}

for (const row of rows) {
  if (!row.pokemon_list) continue;
  const pokemon = row.pokemon_list.split(',').sort();
  if (pokemon.length < 2) continue;

  for (const pair of combinations(pokemon, 2)) {
    const key = pair.sort().join('+');
    if (!pairs[key]) pairs[key] = [];
    pairs[key].push(row.win_rate);
  }
}

const threshold = 25;
const items: Array<[string, number, number]> = [];
for (const [key, rates] of Object.entries(pairs)) {
  if (rates.length >= threshold) {
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    items.push([key, rates.length, avg]);
  }
}

items.sort((a, b) => b[2] - a[2]);

console.log('Top 10 duos by average win rate in Regulation F:');
console.log('| Duo | Count | Avg Win Rate |');
console.log('|-----|-------|--------------|');
for (const [duo, count, avg] of items.slice(0, 10)) {
  console.log(`| ${duo} | ${count} | ${avg.toFixed(3)} |`);
}

db.close();
