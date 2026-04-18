#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DB } from '@vgc/common/database/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../../output');

const FORMAT = 'M-A';
const H2H_MIN_MATCHES = 20;
const COMBO_MIN_TEAMS = 10;
const FOUR_PLUS_WINS_THRESHOLD = 4;

// Computes the display name for a mega pokemon: species plus any X/Y/Z suffix from the item.
// e.g. species="Charizard", item="Charizardite Y" → "Charizard Y"
//      species="Floette",   item="Floettite"       → "Floette"
const MEGA_NAME_EXPR = `
  ps.species || CASE
    WHEN ps.item LIKE '% X' THEN ' X'
    WHEN ps.item LIKE '% Y' THEN ' Y'
    WHEN ps.item LIKE '% Z' THEN ' Z'
    ELSE ''
  END`;

// Shared CTE used by all three mega queries.
function megaTeamPokemonCte(): string {
  return `
    mega_team_pokemon AS (
      SELECT DISTINCT t.id AS team_id,
        ${MEGA_NAME_EXPR} AS pokemon
      FROM teams t
      JOIN tournaments tour ON t.tournament_id = tour.id
      JOIN pokemon_sets ps ON ps.team_id = t.id
      WHERE tour.format = '${FORMAT}' AND ps.is_mega = 1
    ),
    mega_teams AS (
      SELECT DISTINCT team_id FROM mega_team_pokemon
    )`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

function generatePokemonUsage(db: DB): Record<string, unknown>[] {
  return db.prepare(`
    WITH
    ma_teams AS (
      SELECT DISTINCT t.id AS team_id
      FROM teams t
      JOIN tournaments tour ON t.tournament_id = tour.id
      WHERE tour.format = '${FORMAT}'
    ),
    four_plus_teams AS (
      SELECT DISTINCT t.id AS team_id
      FROM teams t
      JOIN tournaments tour ON t.tournament_id = tour.id
      JOIN tournament_standings ts
        ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
      WHERE tour.format = '${FORMAT}' AND ts.wins >= ${FOUR_PLUS_WINS_THRESHOLD}
    ),
    top_cut_teams AS (
      SELECT DISTINCT mp.team_id
      FROM match_participants mp
      JOIN matches m ON mp.match_id = m.id
      JOIN teams t ON mp.team_id = t.id
      JOIN tournaments tour ON t.tournament_id = tour.id
      WHERE tour.format = '${FORMAT}' AND m.phase >= 2
    ),
    total_ma AS (SELECT COUNT(*) AS cnt FROM ma_teams),
    total_4plus AS (SELECT COUNT(*) AS cnt FROM four_plus_teams),
    total_top_cut AS (SELECT COUNT(*) AS cnt FROM top_cut_teams),
    species_all AS (
      SELECT ps.species, ps.is_mega,
        COUNT(DISTINCT ps.team_id) AS teams,
        ROUND(CAST(SUM(mp.score) AS REAL) * 100.0 / COUNT(mp.id), 2) AS win_rate
      FROM pokemon_sets ps
      JOIN ma_teams mt ON ps.team_id = mt.team_id
      JOIN match_participants mp ON mp.team_id = ps.team_id
      GROUP BY ps.species, ps.is_mega
    ),
    species_4plus AS (
      SELECT ps.species, ps.is_mega,
        COUNT(DISTINCT ps.team_id) AS teams,
        ROUND(CAST(SUM(mp.score) AS REAL) * 100.0 / COUNT(mp.id), 2) AS win_rate
      FROM pokemon_sets ps
      JOIN four_plus_teams ft ON ps.team_id = ft.team_id
      JOIN match_participants mp ON mp.team_id = ps.team_id
      GROUP BY ps.species, ps.is_mega
    ),
    species_top_cut AS (
      SELECT ps.species, ps.is_mega,
        COUNT(DISTINCT ps.team_id) AS teams,
        ROUND(CAST(SUM(mp.score) AS REAL) * 100.0 / COUNT(mp.id), 2) AS win_rate
      FROM pokemon_sets ps
      JOIN top_cut_teams tct ON ps.team_id = tct.team_id
      JOIN match_participants mp ON mp.team_id = ps.team_id
      JOIN matches m ON mp.match_id = m.id
      WHERE m.phase >= 2
      GROUP BY ps.species, ps.is_mega
    )
    SELECT
      sa.species,
      sa.is_mega,
      sa.teams,
      ROUND(CAST(sa.teams AS REAL) * 100.0 / total_ma.cnt, 2) AS usage_pct,
      sa.win_rate,
      COALESCE(s4.teams, 0) AS "4plus_teams",
      ROUND(CAST(COALESCE(s4.teams, 0) AS REAL) * 100.0 / total_4plus.cnt, 2) AS "4plus_usage_pct",
      COALESCE(s4.win_rate, 0) AS "4plus_win_rate",
      COALESCE(stc.teams, 0) AS top_cut_teams,
      ROUND(CAST(COALESCE(stc.teams, 0) AS REAL) * 100.0 / total_top_cut.cnt, 2) AS top_cut_usage_pct,
      COALESCE(stc.win_rate, 0) AS top_cut_win_rate
    FROM species_all sa
    LEFT JOIN species_4plus s4 ON sa.species = s4.species AND sa.is_mega = s4.is_mega
    LEFT JOIN species_top_cut stc ON sa.species = stc.species AND sa.is_mega = stc.is_mega
    CROSS JOIN total_ma
    CROSS JOIN total_4plus
    CROSS JOIN total_top_cut
    ORDER BY sa.teams DESC
  `).all() as Record<string, unknown>[];
}

function generateMegaUsage(db: DB): Record<string, unknown>[] {
  return db.prepare(`
    WITH
    ${megaTeamPokemonCte()},
    four_plus_mega_teams AS (
      SELECT DISTINCT mt.team_id
      FROM mega_teams mt
      JOIN teams t ON mt.team_id = t.id
      JOIN tournament_standings ts
        ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
      WHERE ts.wins >= ${FOUR_PLUS_WINS_THRESHOLD}
    ),
    top_cut_mega_teams AS (
      SELECT DISTINCT mt.team_id
      FROM mega_teams mt
      JOIN match_participants mp ON mp.team_id = mt.team_id
      JOIN matches m ON mp.match_id = m.id
      WHERE m.phase >= 2
    ),
    total_mega AS (SELECT COUNT(*) AS cnt FROM mega_teams),
    total_4plus_mega AS (SELECT COUNT(*) AS cnt FROM four_plus_mega_teams),
    total_top_cut_mega AS (SELECT COUNT(*) AS cnt FROM top_cut_mega_teams),
    pokemon_all AS (
      SELECT mtp.pokemon,
        COUNT(DISTINCT mtp.team_id) AS usage_count,
        ROUND(CAST(SUM(mp.score) AS REAL) * 100.0 / COUNT(mp.id), 2) AS win_rate
      FROM mega_team_pokemon mtp
      JOIN match_participants mp ON mp.team_id = mtp.team_id
      GROUP BY mtp.pokemon
    ),
    pokemon_4plus AS (
      SELECT mtp.pokemon,
        COUNT(DISTINCT mtp.team_id) AS usage_count,
        ROUND(CAST(SUM(mp.score) AS REAL) * 100.0 / COUNT(mp.id), 2) AS win_rate
      FROM mega_team_pokemon mtp
      JOIN four_plus_mega_teams ft ON mtp.team_id = ft.team_id
      JOIN match_participants mp ON mp.team_id = mtp.team_id
      GROUP BY mtp.pokemon
    ),
    pokemon_top_cut AS (
      SELECT mtp.pokemon,
        COUNT(DISTINCT mtp.team_id) AS usage_count,
        ROUND(CAST(SUM(mp.score) AS REAL) * 100.0 / COUNT(mp.id), 2) AS win_rate
      FROM mega_team_pokemon mtp
      JOIN top_cut_mega_teams tct ON mtp.team_id = tct.team_id
      JOIN match_participants mp ON mp.team_id = mtp.team_id
      JOIN matches m ON mp.match_id = m.id
      WHERE m.phase >= 2
      GROUP BY mtp.pokemon
    )
    SELECT
      pa.pokemon,
      pa.usage_count,
      ROUND(CAST(pa.usage_count AS REAL) * 100.0 / total_mega.cnt, 2) AS usage_pct,
      pa.win_rate,
      COALESCE(p4.usage_count, 0) AS "4plus_teams",
      ROUND(CAST(COALESCE(p4.usage_count, 0) AS REAL) * 100.0 / total_4plus_mega.cnt, 2) AS "4plus_usage_pct",
      COALESCE(p4.win_rate, 0) AS "4plus_win_rate",
      COALESCE(ptc.usage_count, 0) AS top_cut_teams,
      ROUND(CAST(COALESCE(ptc.usage_count, 0) AS REAL) * 100.0 / total_top_cut_mega.cnt, 2) AS top_cut_usage_pct,
      COALESCE(ptc.win_rate, 0) AS top_cut_win_rate
    FROM pokemon_all pa
    LEFT JOIN pokemon_4plus p4 ON pa.pokemon = p4.pokemon
    LEFT JOIN pokemon_top_cut ptc ON pa.pokemon = ptc.pokemon
    CROSS JOIN total_mega
    CROSS JOIN total_4plus_mega
    CROSS JOIN total_top_cut_mega
    ORDER BY pa.usage_count DESC
  `).all() as Record<string, unknown>[];
}

function generateMegaH2H(db: DB): Record<string, unknown>[] {
  return db.prepare(`
    WITH
    ${megaTeamPokemonCte()},
    four_plus_team_ids AS (
      SELECT DISTINCT t.id AS team_id
      FROM teams t
      JOIN tournaments tour ON t.tournament_id = tour.id
      JOIN tournament_standings ts
        ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
      WHERE tour.format = '${FORMAT}' AND ts.wins >= ${FOUR_PLUS_WINS_THRESHOLD}
    ),
    h2h_raw AS (
      SELECT
        CASE WHEN mtp1.pokemon < mtp2.pokemon THEN mtp1.pokemon ELSE mtp2.pokemon END AS p1,
        CASE WHEN mtp1.pokemon < mtp2.pokemon THEN mtp2.pokemon ELSE mtp1.pokemon END AS p2,
        CASE WHEN mtp1.pokemon < mtp2.pokemon THEN mp1.score ELSE mp2.score END AS score1,
        CASE WHEN mtp1.pokemon < mtp2.pokemon THEN mp2.score ELSE mp1.score END AS score2,
        m.phase,
        CASE WHEN mp1.team_id IN (SELECT team_id FROM four_plus_team_ids)
              AND mp2.team_id IN (SELECT team_id FROM four_plus_team_ids)
        THEN 1 ELSE 0 END AS both_4plus
      FROM match_participants mp1
      JOIN match_participants mp2
        ON mp1.match_id = mp2.match_id AND mp1.team_id < mp2.team_id
      JOIN matches m ON mp1.match_id = m.id
      JOIN mega_team_pokemon mtp1 ON mtp1.team_id = mp1.team_id
      JOIN mega_team_pokemon mtp2 ON mtp2.team_id = mp2.team_id
      WHERE mtp1.pokemon != mtp2.pokemon
    )
    SELECT
      p1 AS "Mega 1",
      p2 AS "Mega 2",
      COUNT(*) AS matches,
      SUM(CASE WHEN score1 > score2 THEN 1 ELSE 0 END) AS mega1_wins,
      SUM(CASE WHEN score2 > score1 THEN 1 ELSE 0 END) AS mega2_wins,
      ROUND(CAST(SUM(CASE WHEN score1 > score2 THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*), 2) AS mega1_winrate,
      SUM(both_4plus) AS "4plus_matches",
      SUM(CASE WHEN both_4plus = 1 AND score1 > score2 THEN 1 ELSE 0 END) AS "4plus_mega1_wins",
      SUM(CASE WHEN both_4plus = 1 AND score2 > score1 THEN 1 ELSE 0 END) AS "4plus_mega2_wins",
      CASE WHEN SUM(both_4plus) > 0
        THEN ROUND(CAST(SUM(CASE WHEN both_4plus = 1 AND score1 > score2 THEN 1 ELSE 0 END) AS REAL) * 100.0 / SUM(both_4plus), 2)
        ELSE NULL END AS "4plus_mega1_winrate",
      SUM(CASE WHEN phase >= 2 THEN 1 ELSE 0 END) AS top_cut_matches,
      SUM(CASE WHEN phase >= 2 AND score1 > score2 THEN 1 ELSE 0 END) AS top_cut_mega1_wins,
      SUM(CASE WHEN phase >= 2 AND score2 > score1 THEN 1 ELSE 0 END) AS top_cut_mega2_wins,
      CASE WHEN SUM(CASE WHEN phase >= 2 THEN 1 ELSE 0 END) > 0
        THEN ROUND(CAST(SUM(CASE WHEN phase >= 2 AND score1 > score2 THEN 1 ELSE 0 END) AS REAL) * 100.0 / SUM(CASE WHEN phase >= 2 THEN 1 ELSE 0 END), 2)
        ELSE NULL END AS top_cut_mega1_winrate
    FROM h2h_raw
    GROUP BY p1, p2
    HAVING COUNT(*) >= ${H2H_MIN_MATCHES}
    ORDER BY mega1_winrate DESC
  `).all() as Record<string, unknown>[];
}

function generateMegaCombos(db: DB): Record<string, unknown>[] {
  return db.prepare(`
    WITH
    ${megaTeamPokemonCte()},
    four_plus_mega_teams AS (
      SELECT DISTINCT mt.team_id
      FROM mega_teams mt
      JOIN teams t ON mt.team_id = t.id
      JOIN tournament_standings ts
        ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
      WHERE ts.wins >= ${FOUR_PLUS_WINS_THRESHOLD}
    ),
    top_cut_mega_teams AS (
      SELECT DISTINCT mt.team_id
      FROM mega_teams mt
      JOIN match_participants mp ON mp.team_id = mt.team_id
      JOIN matches m ON mp.match_id = m.id
      WHERE m.phase >= 2
    ),
    total_mega_teams AS (SELECT COUNT(DISTINCT team_id) AS cnt FROM mega_team_pokemon),
    total_4plus_mega AS (SELECT COUNT(*) AS cnt FROM four_plus_mega_teams),
    total_top_cut_mega AS (SELECT COUNT(*) AS cnt FROM top_cut_mega_teams),
    team_combos AS (
      SELECT team_id, GROUP_CONCAT(pokemon, ' + ') AS combo
      FROM (SELECT team_id, pokemon FROM mega_team_pokemon ORDER BY pokemon)
      GROUP BY team_id
    ),
    combo_counts AS (
      SELECT combo, COUNT(*) AS usage_count
      FROM team_combos
      GROUP BY combo
    ),
    combo_stats AS (
      SELECT
        tc.combo,
        ROUND(CAST(SUM(mp.score) AS REAL) * 100.0 / COUNT(*), 2) AS win_rate,
        COUNT(DISTINCT CASE WHEN tc.team_id IN (SELECT team_id FROM four_plus_mega_teams) THEN tc.team_id END) AS "4plus_teams",
        ROUND(CAST(SUM(CASE WHEN mp.score IS NOT NULL AND tc.team_id IN (SELECT team_id FROM four_plus_mega_teams) THEN mp.score ELSE 0 END) AS REAL) * 100.0 /
          NULLIF(COUNT(CASE WHEN tc.team_id IN (SELECT team_id FROM four_plus_mega_teams) THEN 1 END), 0), 2) AS "4plus_win_rate",
        COUNT(DISTINCT CASE WHEN tc.team_id IN (SELECT team_id FROM top_cut_mega_teams) THEN tc.team_id END) AS top_cut_teams,
        ROUND(CAST(SUM(CASE WHEN m.phase >= 2 AND tc.team_id IN (SELECT team_id FROM top_cut_mega_teams) THEN mp.score ELSE 0 END) AS REAL) * 100.0 /
          NULLIF(COUNT(CASE WHEN m.phase >= 2 AND tc.team_id IN (SELECT team_id FROM top_cut_mega_teams) THEN 1 END), 0), 2) AS top_cut_win_rate
      FROM team_combos tc
      JOIN match_participants mp ON mp.team_id = tc.team_id
      JOIN matches m ON mp.match_id = m.id
      GROUP BY tc.combo
    )
    SELECT
      cc.combo,
      cc.usage_count,
      ROUND(CAST(cc.usage_count AS REAL) * 100.0 / tmt.cnt, 2) AS usage_pct,
      cs.win_rate,
      cs."4plus_teams",
      ROUND(CAST(cs."4plus_teams" AS REAL) * 100.0 / t4.cnt, 2) AS "4plus_usage_pct",
      cs."4plus_win_rate",
      cs.top_cut_teams,
      ROUND(CAST(cs.top_cut_teams AS REAL) * 100.0 / ttc.cnt, 2) AS top_cut_usage_pct,
      cs.top_cut_win_rate
    FROM combo_counts cc
    JOIN combo_stats cs ON cc.combo = cs.combo
    CROSS JOIN total_mega_teams tmt
    CROSS JOIN total_4plus_mega t4
    CROSS JOIN total_top_cut_mega ttc
    WHERE cc.usage_count >= ${COMBO_MIN_TEAMS}
    ORDER BY cc.usage_count DESC
  `).all() as Record<string, unknown>[];
}

const db = new DB();
await db.init();

try {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Generating pokemon_usage.csv...');
  const pokemonUsage = generatePokemonUsage(db);
  writeFileSync(resolve(OUTPUT_DIR, 'pokemon_usage.csv'), toCsv(pokemonUsage));
  console.log(`  ${pokemonUsage.length} rows`);

  console.log('Generating mega_pokemon_usage.csv...');
  const megaUsage = generateMegaUsage(db);
  writeFileSync(resolve(OUTPUT_DIR, 'mega_pokemon_usage.csv'), toCsv(megaUsage));
  console.log(`  ${megaUsage.length} items`);

  console.log('Generating mega_h2h.csv...');
  const megaH2H = generateMegaH2H(db);
  writeFileSync(resolve(OUTPUT_DIR, 'mega_h2h.csv'), toCsv(megaH2H));
  console.log(`  ${megaH2H.length} matchups`);

  console.log('Generating mega_combos.csv...');
  const megaCombos = generateMegaCombos(db);
  writeFileSync(resolve(OUTPUT_DIR, 'mega_combos.csv'), toCsv(megaCombos));
  console.log(`  ${megaCombos.length} combos`);

  console.log('Done.');
} finally {
  db.close();
}
