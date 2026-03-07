#!/usr/bin/env node

import { DB } from '../database/db.js';

const db = new DB();
await db.init();

const query = `
SELECT (SELECT GROUP_CONCAT(DISTINCT ps.species) FROM pokemon_sets ps WHERE ps.team_id = t.id AND ps.species NOT IN ('Chien-Pao', 'Dragonite') ORDER BY ps.species) AS partners,
(ts.wins * 1.0 / (ts.wins + ts.losses)) AS win_rate
FROM teams t
JOIN tournaments tour ON t.tournament_id = tour.id
JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
WHERE tour.format = 'SVF'
AND ts.wins + ts.losses > 0
AND EXISTS (SELECT 1 FROM pokemon_sets ps1 WHERE ps1.team_id = t.id AND ps1.species = 'Chien-Pao')
AND EXISTS (SELECT 1 FROM pokemon_sets ps2 WHERE ps2.team_id = t.id AND ps2.species = 'Dragonite')
`;

const rows = db.prepare(query).all() as Array<{ partners: string | null; win_rate: number }>;
const N = rows.length;
const threshold = 25;
console.log(`Total teams N: ${N}, threshold: ${threshold}`);

const single: Record<string, number[]> = {};
const double: Record<string, number[]> = {};
const trio: Record<string, number[]> = {};
const quad: Record<string, number[]> = {};

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
  if (!row.partners) continue;
  const partners = row.partners.split(',');
  if (partners.length !== 4) continue;
  const winRate = row.win_rate;

  for (const p of partners) {
    if (!single[p]) single[p] = [];
    single[p].push(winRate);
  }

  for (const pair of combinations(partners, 2)) {
    const key = pair.sort().join('+');
    if (!double[key]) double[key] = [];
    double[key].push(winRate);
  }

  for (const tr of combinations(partners, 3)) {
    const key = tr.sort().join('+');
    if (!trio[key]) trio[key] = [];
    trio[key].push(winRate);
  }

  const quadKey = partners.sort().join('+');
  if (!quad[quadKey]) quad[quadKey] = [];
  quad[quadKey].push(winRate);
}

function getTop(category: Record<string, number[]>, threshold: number): Array<[string, number, number]> {
  const items: Array<[string, number, number]> = [];
  for (const [key, rates] of Object.entries(category)) {
    if (rates.length >= threshold) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      items.push([key, rates.length, avg]);
    }
  }
  items.sort((a, b) => b[2] - a[2]);
  return items.slice(0, 10);
}

const topSingle = getTop(single, threshold);
const topDouble = getTop(double, threshold);
const topTrio = getTop(trio, threshold);
const topQuad = getTop(quad, threshold);

console.log('\n### Single Partners');
console.log('| Partners | Count | Avg Win Rate |');
console.log('|----------|-------|--------------|');
for (const [p, c, a] of topSingle) {
  console.log(`| ${p} | ${c} | ${a.toFixed(3)} |`);
}

console.log('\n### Double Partners');
console.log('| Partners | Count | Avg Win Rate |');
console.log('|----------|-------|--------------|');
for (const [p, c, a] of topDouble) {
  console.log(`| ${p} | ${c} | ${a.toFixed(3)} |`);
}

console.log('\n### Trios');
console.log('| Partners | Count | Avg Win Rate |');
console.log('|----------|-------|--------------|');
for (const [p, c, a] of topTrio) {
  console.log(`| ${p} | ${c} | ${a.toFixed(3)} |`);
}

console.log('\n### Quads');
console.log('| Partners | Count | Avg Win Rate |');
console.log('|----------|-------|--------------|');
for (const [p, c, a] of topQuad) {
  console.log(`| ${p} | ${c} | ${a.toFixed(3)} |`);
}

db.close();
