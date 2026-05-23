-- VGC Usage Stats — PostgreSQL RPC functions for Supabase
-- Run in the Supabase SQL editor (safe to re-run; all are CREATE OR REPLACE).
-- After running, execute: NOTIFY pgrst, 'reload schema';

-- ─── Drop old overloads ───────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_pokemon_usage();
DROP FUNCTION IF EXISTS get_pokemon_usage(DATE);
DROP FUNCTION IF EXISTS get_mega_usage();
DROP FUNCTION IF EXISTS get_mega_usage(DATE);
DROP FUNCTION IF EXISTS get_mega_h2h(INT);
DROP FUNCTION IF EXISTS get_mega_h2h(INT, DATE);
DROP FUNCTION IF EXISTS get_mega_combos(INT);
DROP FUNCTION IF EXISTS get_mega_combos(INT, DATE);
DROP FUNCTION IF EXISTS get_mega_teammates(TEXT);
DROP FUNCTION IF EXISTS get_pokemon_moves(TEXT);
DROP FUNCTION IF EXISTS get_pokemon_moves(TEXT, DATE);
DROP FUNCTION IF EXISTS get_pokemon_items(TEXT);
DROP FUNCTION IF EXISTS get_pokemon_items(TEXT, DATE);
DROP FUNCTION IF EXISTS get_pokemon_partners(TEXT);
DROP FUNCTION IF EXISTS get_pokemon_partners(TEXT, DATE);
DROP FUNCTION IF EXISTS get_pokemon_matchups(TEXT);
DROP FUNCTION IF EXISTS get_pokemon_matchups(TEXT, DATE);
DROP FUNCTION IF EXISTS top_cut_teams_ma();
DROP FUNCTION IF EXISTS top_cut_match_participants_ma();

-- ─── Helper: canonical mega items ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION canonical_mega_items()
RETURNS TABLE (item TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT unnest(ARRAY[
    'Charizardite Y','Charizardite X','Floettite','Gengarite','Tyranitarite',
    'Froslassite','Dragoninite','Delphoxite','Gardevoirite','Glimmoranite',
    'Meganiumite','Kangaskhanite','Aerodactylite','Golurkite','Venusaurite',
    'Starminite','Scizorite','Aggronite','Scovillainite','Garchompite',
    'Crabominite','Gyaradosite','Lucarionite','Drampanite','Blastoisinite',
    'Lopunnite','Chesnaughtite','Skarmorite','Hawluchanite','Cameruptite',
    'Manectite','Excadrite','Meowsticite','Galladite','Greninjite',
    'Ampharosite','Clefablite','Chandelurite','Slowbronite','Salamencite',
    'Altarianite','Alakazite','Heracronite','Chimechite','Metagrossite',
    'Abomasite','Dragonitite','Swampertite','Sharpedonite','Sablenite',
    'Pinsirite','Steelixite','Emboarite','Dragalgite','Absolite',
    'Victreebelite','Medichamite','Houndoominite','Beedrillite','Raichunite X',
    'Pidgeotite','Mawilite','Feraligatrite','Feraligite','Absolite Z',
    'Garchompite Z','Lucarionite Z'
  ]);
$$;
GRANT EXECUTE ON FUNCTION canonical_mega_items() TO anon;

-- ─── Helper: top-cut team IDs for M-A ────────────────────────────────────────

CREATE OR REPLACE FUNCTION top_cut_teams_ma(p_since DATE DEFAULT NULL)
RETURNS TABLE (team_id BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH tc_phases AS (
    SELECT m.tournament_id, MAX(m.phase) AS max_phase
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE t.format = 'M-A' AND (p_since IS NULL OR t.date >= p_since) AND m.phase IS NOT NULL
    GROUP BY m.tournament_id
    HAVING COUNT(DISTINCT m.phase) > 1
  )
  SELECT DISTINCT mp.team_id
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id
  JOIN tc_phases tcp ON tcp.tournament_id = m.tournament_id AND m.phase = tcp.max_phase
$$;
GRANT EXECUTE ON FUNCTION top_cut_teams_ma(DATE) TO anon;

-- ─── Helper: top-cut match_participants rows for M-A ─────────────────────────
-- Only matches played in the final elimination phase.

CREATE OR REPLACE FUNCTION top_cut_match_participants_ma(p_since DATE DEFAULT NULL)
RETURNS TABLE (team_id BIGINT, score INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH tc_phases AS (
    SELECT m.tournament_id, MAX(m.phase) AS max_phase
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE t.format = 'M-A' AND (p_since IS NULL OR t.date >= p_since) AND m.phase IS NOT NULL
    GROUP BY m.tournament_id
    HAVING COUNT(DISTINCT m.phase) > 1
  )
  SELECT mp.team_id, mp.score
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id
  JOIN tc_phases tcp ON tcp.tournament_id = m.tournament_id AND m.phase = tcp.max_phase
$$;
GRANT EXECUTE ON FUNCTION top_cut_match_participants_ma(DATE) TO anon;

-- ─── 1. Pokemon usage ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_usage(p_since DATE DEFAULT NULL)
RETURNS TABLE (
  species       TEXT,
  is_mega       BOOLEAN,
  teams         BIGINT,
  usage_pct     NUMERIC,
  win_rate      NUMERIC,
  top_cut_teams BIGINT,
  top_cut_usage NUMERIC,
  top_cut_wr    NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  total AS (
    SELECT COUNT(*)::numeric AS n
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since)
  ),
  top_cut_total AS (SELECT COUNT(*)::numeric AS n FROM top_cut_teams_ma(p_since)),
  base AS (
    SELECT
      ps.species,
      BOOL_OR(ps.is_mega) AS is_mega,
      COUNT(DISTINCT t.id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN match_participants mp ON mp.team_id = t.id
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since)
    GROUP BY ps.species
  ),
  top_cut AS (
    SELECT
      ps.species,
      COUNT(DISTINCT t.id) AS teams,
      ROUND(SUM(tcmp.score) * 100.0 / NULLIF(COUNT(tcmp.score), 0), 2) AS win_rate
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN top_cut_match_participants_ma(p_since) tcmp ON tcmp.team_id = t.id
    GROUP BY ps.species
  )
  SELECT
    b.species, b.is_mega, b.teams,
    ROUND(b.teams * 100.0 / total.n, 2),
    b.win_rate,
    COALESCE(tc.teams, 0),
    ROUND(COALESCE(tc.teams, 0) * 100.0 / top_cut_total.n, 2),
    tc.win_rate
  FROM base b
  CROSS JOIN total CROSS JOIN top_cut_total
  LEFT JOIN top_cut tc ON tc.species = b.species
  ORDER BY b.teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_usage(DATE) TO anon;

-- ─── 2. Mega usage ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_usage(p_since DATE DEFAULT NULL)
RETURNS TABLE (
  pokemon       TEXT,
  teams         BIGINT,
  usage_pct     NUMERIC,
  win_rate      NUMERIC,
  top_cut_teams BIGINT,
  top_cut_usage NUMERIC,
  top_cut_wr    NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  canonical AS (SELECT item FROM canonical_mega_items()),
  team_mega AS (
    SELECT DISTINCT ON (t.id)
      t.id AS team_id, t.player_id, t.tournament_id, ci.item
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN pokemon_sets ps  ON ps.team_id = t.id
    JOIN canonical ci     ON LOWER(ps.item) = LOWER(ci.item)
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since)
    ORDER BY t.id, ci.item
  ),
  total_mega    AS (SELECT COUNT(DISTINCT team_id)::numeric AS n FROM team_mega),
  top_cut_mega  AS (
    SELECT COUNT(DISTINCT tm.team_id)::numeric AS n
    FROM team_mega tm JOIN top_cut_teams_ma(p_since) tc ON tc.team_id = tm.team_id
  ),
  base AS (
    SELECT tm.item AS pokemon, COUNT(DISTINCT tm.team_id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM team_mega tm JOIN match_participants mp ON mp.team_id = tm.team_id
    GROUP BY tm.item
  ),
  top_cut AS (
    SELECT tm.item AS pokemon, COUNT(DISTINCT tm.team_id) AS teams,
      ROUND(SUM(tcmp.score) * 100.0 / NULLIF(COUNT(tcmp.score), 0), 2) AS win_rate
    FROM team_mega tm JOIN top_cut_match_participants_ma(p_since) tcmp ON tcmp.team_id = tm.team_id
    GROUP BY tm.item
  )
  SELECT
    b.pokemon, b.teams,
    ROUND(b.teams * 100.0 / total_mega.n, 2), b.win_rate,
    COALESCE(tc.teams, 0), ROUND(COALESCE(tc.teams, 0) * 100.0 / top_cut_mega.n, 2), tc.win_rate
  FROM base b
  CROSS JOIN total_mega CROSS JOIN top_cut_mega
  LEFT JOIN top_cut tc ON tc.pokemon = b.pokemon
  ORDER BY b.teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_mega_usage(DATE) TO anon;

-- ─── 3. Mega H2H ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_h2h(p_min_matches INT DEFAULT 20, p_since DATE DEFAULT NULL)
RETURNS TABLE (
  mega1 TEXT, mega2 TEXT,
  matches BIGINT, mega1_wins BIGINT, mega2_wins BIGINT, mega1_wr NUMERIC,
  top_cut_matches BIGINT, top_cut_mega1_wins BIGINT, top_cut_mega2_wins BIGINT, top_cut_mega1_wr NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  canonical AS (SELECT item FROM canonical_mega_items()),
  tc_phases AS (
    SELECT tournament_id, MAX(phase) AS max_phase
    FROM matches WHERE phase IS NOT NULL
    GROUP BY tournament_id HAVING COUNT(DISTINCT phase) > 1
  ),
  team_mega AS (
    SELECT DISTINCT ON (t.id)
      t.id AS team_id, t.player_id, t.tournament_id, ci.item
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN pokemon_sets ps  ON ps.team_id = t.id
    JOIN canonical ci     ON LOWER(ps.item) = LOWER(ci.item)
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since)
    ORDER BY t.id, ci.item
  ),
  matchups AS (
    SELECT mp1.team_id AS t1, mp2.team_id AS t2,
           mp1.score AS s1, mp2.score AS s2,
           m.tournament_id, m.phase
    FROM match_participants mp1
    JOIN match_participants mp2 ON mp1.match_id = mp2.match_id AND mp1.team_id < mp2.team_id
    JOIN matches m ON m.id = mp1.match_id
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE t.format = 'M-A' AND (p_since IS NULL OR t.date >= p_since)
  ),
  mega_matchups AS (
    SELECT
      LEAST(tm1.item, tm2.item) AS mega1, GREATEST(tm1.item, tm2.item) AS mega2,
      CASE WHEN tm1.item < tm2.item THEN mu.s1 ELSE mu.s2 END AS score1,
      CASE WHEN tm1.item < tm2.item THEN mu.s2 ELSE mu.s1 END AS score2,
      mu.tournament_id, mu.phase
    FROM matchups mu
    JOIN team_mega tm1 ON tm1.team_id = mu.t1
    JOIN team_mega tm2 ON tm2.team_id = mu.t2
    WHERE tm1.item <> tm2.item
  ),
  base AS (
    SELECT mega1, mega2, COUNT(*) AS matches, SUM(score1) AS mega1_wins, SUM(score2) AS mega2_wins,
      ROUND(SUM(score1) * 100.0 / NULLIF(COUNT(*), 0), 2) AS mega1_wr
    FROM mega_matchups GROUP BY mega1, mega2
  ),
  top_cut AS (
    SELECT mm.mega1, mm.mega2, COUNT(*) AS matches,
      SUM(mm.score1) AS mega1_wins, SUM(mm.score2) AS mega2_wins,
      ROUND(SUM(mm.score1) * 100.0 / NULLIF(COUNT(*), 0), 2) AS mega1_wr
    FROM mega_matchups mm
    JOIN tc_phases tcp ON tcp.tournament_id = mm.tournament_id AND mm.phase = tcp.max_phase
    GROUP BY mm.mega1, mm.mega2
  )
  SELECT
    b.mega1, b.mega2, b.matches, b.mega1_wins, b.mega2_wins, b.mega1_wr,
    COALESCE(tc.matches, 0), COALESCE(tc.mega1_wins, 0), COALESCE(tc.mega2_wins, 0), tc.mega1_wr
  FROM base b
  LEFT JOIN top_cut tc ON tc.mega1 = b.mega1 AND tc.mega2 = b.mega2
  WHERE b.matches >= p_min_matches
  ORDER BY b.matches DESC
$$;
GRANT EXECUTE ON FUNCTION get_mega_h2h(INT, DATE) TO anon;

-- ─── 4. Mega combos ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_combos(p_min_teams INT DEFAULT 10, p_since DATE DEFAULT NULL)
RETURNS TABLE (
  combo TEXT, teams BIGINT, usage_pct NUMERIC, win_rate NUMERIC,
  top_cut_teams BIGINT, top_cut_usage NUMERIC, top_cut_wr NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  canonical AS (SELECT item FROM canonical_mega_items()),
  team_megas AS (
    SELECT DISTINCT t.id AS team_id, t.player_id, t.tournament_id, ci.item
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN pokemon_sets ps  ON ps.team_id = t.id
    JOIN canonical ci     ON LOWER(ps.item) = LOWER(ci.item)
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since)
  ),
  team_combos AS (
    SELECT team_id, player_id, tournament_id, STRING_AGG(item, ' + ' ORDER BY item) AS combo
    FROM team_megas GROUP BY team_id, player_id, tournament_id
  ),
  total_mega    AS (SELECT COUNT(DISTINCT team_id)::numeric AS n FROM team_combos),
  top_cut_total AS (
    SELECT COUNT(DISTINCT tc.team_id)::numeric AS n
    FROM team_combos tc JOIN top_cut_teams_ma(p_since) tct ON tct.team_id = tc.team_id
  ),
  base AS (
    SELECT tc.combo, COUNT(DISTINCT tc.team_id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM team_combos tc JOIN match_participants mp ON mp.team_id = tc.team_id
    GROUP BY tc.combo
  ),
  top_cut AS (
    SELECT tc.combo, COUNT(DISTINCT tc.team_id) AS teams,
      ROUND(SUM(tcmp.score) * 100.0 / NULLIF(COUNT(tcmp.score), 0), 2) AS win_rate
    FROM team_combos tc JOIN top_cut_match_participants_ma(p_since) tcmp ON tcmp.team_id = tc.team_id
    GROUP BY tc.combo
  )
  SELECT
    b.combo, b.teams, ROUND(b.teams * 100.0 / total_mega.n, 2), b.win_rate,
    COALESCE(tc.teams, 0), ROUND(COALESCE(tc.teams, 0) * 100.0 / top_cut_total.n, 2), tc.win_rate
  FROM base b
  CROSS JOIN total_mega CROSS JOIN top_cut_total
  LEFT JOIN top_cut tc ON tc.combo = b.combo
  WHERE b.teams >= p_min_teams
  ORDER BY b.teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_mega_combos(INT, DATE) TO anon;

-- ─── 5. Mega teammates ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_teammates(p_mega_item TEXT, p_since DATE DEFAULT NULL)
RETURNS TABLE (
  species TEXT, teams BIGINT, usage_pct NUMERIC,
  win_rate_with NUMERIC, win_rate_without NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  canonical AS (SELECT item FROM canonical_mega_items()),
  mega_teams AS (
    SELECT DISTINCT t.id AS team_id
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN pokemon_sets ps  ON ps.team_id = t.id
    JOIN canonical ci     ON LOWER(ps.item) = LOWER(ci.item)
    WHERE tour.format = 'M-A'
      AND LOWER(ci.item) = LOWER(p_mega_item)
      AND (p_since IS NULL OR tour.date >= p_since)
  ),
  total_mega AS (SELECT COUNT(*)::numeric AS n FROM mega_teams),
  teammates AS (
    SELECT ps.species, COUNT(DISTINCT t.id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate_with
    FROM pokemon_sets ps
    JOIN mega_teams mt ON mt.team_id = ps.team_id
    JOIN teams t ON t.id = ps.team_id
    JOIN match_participants mp ON mp.team_id = t.id
    WHERE LOWER(COALESCE(ps.item, '')) <> LOWER(p_mega_item)
    GROUP BY ps.species
  ),
  without AS (
    SELECT ps.species,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate_without
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN match_participants mp ON mp.team_id = t.id
    WHERE tour.format = 'M-A'
      AND (p_since IS NULL OR tour.date >= p_since)
      AND t.id NOT IN (SELECT team_id FROM mega_teams)
    GROUP BY ps.species
  )
  SELECT tm.species, tm.teams, ROUND(tm.teams * 100.0 / total_mega.n, 2),
    tm.win_rate_with, w.win_rate_without
  FROM teammates tm CROSS JOIN total_mega LEFT JOIN without w ON w.species = tm.species
  WHERE tm.teams >= 5
  ORDER BY tm.teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_mega_teammates(TEXT, DATE) TO anon;

-- ─── 6. Pokemon detail — moves ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_moves(p_species TEXT, p_since DATE DEFAULT NULL, p_mode TEXT DEFAULT 'all')
RETURNS TABLE (move_name TEXT, teams BIGINT, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH tc_phases AS (
    SELECT tournament_id, MAX(phase) AS max_phase
    FROM matches WHERE phase IS NOT NULL
    GROUP BY tournament_id HAVING COUNT(DISTINCT phase) > 1
  )
  SELECT MAX(mv.move_name) AS move_name,
    COUNT(DISTINCT t.id) AS teams,
    ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
  FROM moves mv
  JOIN pokemon_sets ps ON ps.id = mv.pokemon_set_id
  JOIN teams t ON t.id = ps.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  JOIN match_participants mp ON mp.team_id = t.id
  JOIN matches mf ON mf.id = mp.match_id
  LEFT JOIN tc_phases tcp ON tcp.tournament_id = mf.tournament_id AND mf.phase = tcp.max_phase
  WHERE tour.format = 'M-A'
    AND LOWER(ps.species) = LOWER(p_species)
    AND (p_since IS NULL OR tour.date >= p_since)
    AND (p_mode = 'all' OR tcp.max_phase IS NOT NULL)
  GROUP BY LOWER(mv.move_name)
  HAVING COUNT(DISTINCT t.id) >= 3
  ORDER BY teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_moves(TEXT, DATE, TEXT) TO anon;

-- ─── 7. Pokemon detail — items ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_items(p_species TEXT, p_since DATE DEFAULT NULL, p_mode TEXT DEFAULT 'all')
RETURNS TABLE (item TEXT, teams BIGINT, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH tc_phases AS (
    SELECT tournament_id, MAX(phase) AS max_phase
    FROM matches WHERE phase IS NOT NULL
    GROUP BY tournament_id HAVING COUNT(DISTINCT phase) > 1
  )
  SELECT COALESCE(NULLIF(ps.item, ''), 'No Item') AS item,
    COUNT(DISTINCT t.id) AS teams,
    ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
  FROM pokemon_sets ps
  JOIN teams t ON t.id = ps.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  JOIN match_participants mp ON mp.team_id = t.id
  JOIN matches mf ON mf.id = mp.match_id
  LEFT JOIN tc_phases tcp ON tcp.tournament_id = mf.tournament_id AND mf.phase = tcp.max_phase
  WHERE tour.format = 'M-A'
    AND LOWER(ps.species) = LOWER(p_species)
    AND (p_since IS NULL OR tour.date >= p_since)
    AND (p_mode = 'all' OR tcp.max_phase IS NOT NULL)
  GROUP BY LOWER(ps.item), COALESCE(NULLIF(ps.item, ''), 'No Item')
  HAVING COUNT(DISTINCT t.id) >= 3
  ORDER BY teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_items(TEXT, DATE, TEXT) TO anon;

-- ─── 8. Pokemon detail — partners ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_partners(p_species TEXT, p_since DATE DEFAULT NULL, p_mode TEXT DEFAULT 'all')
RETURNS TABLE (partner_species TEXT, teams BIGINT, usage_pct NUMERIC, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  tc_phases AS (
    SELECT tournament_id, MAX(phase) AS max_phase
    FROM matches WHERE phase IS NOT NULL
    GROUP BY tournament_id HAVING COUNT(DISTINCT phase) > 1
  ),
  target_teams AS (
    SELECT DISTINCT t.id AS team_id
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN match_participants mp ON mp.team_id = t.id
    JOIN matches mf ON mf.id = mp.match_id
    LEFT JOIN tc_phases tcp ON tcp.tournament_id = mf.tournament_id AND mf.phase = tcp.max_phase
    WHERE tour.format = 'M-A'
      AND LOWER(ps.species) = LOWER(p_species)
      AND (p_since IS NULL OR tour.date >= p_since)
      AND (p_mode = 'all' OR tcp.max_phase IS NOT NULL)
  ),
  total AS (SELECT COUNT(*)::numeric AS n FROM target_teams),
  filtered_mp AS (
    SELECT mp.team_id, mp.score
    FROM match_participants mp
    JOIN matches mf ON mf.id = mp.match_id
    LEFT JOIN tc_phases tcp ON tcp.tournament_id = mf.tournament_id AND mf.phase = tcp.max_phase
    WHERE p_mode = 'all' OR tcp.max_phase IS NOT NULL
  )
  SELECT
    ps.species AS partner_species,
    COUNT(DISTINCT tt.team_id) AS teams,
    ROUND(COUNT(DISTINCT tt.team_id) * 100.0 / total.n, 2) AS usage_pct,
    ROUND(SUM(fmp.score) * 100.0 / NULLIF(COUNT(fmp.score), 0), 2) AS win_rate
  FROM target_teams tt
  JOIN pokemon_sets ps ON ps.team_id = tt.team_id
  JOIN filtered_mp fmp ON fmp.team_id = tt.team_id
  CROSS JOIN total
  WHERE LOWER(ps.species) != LOWER(p_species)
  GROUP BY ps.species, total.n
  HAVING COUNT(DISTINCT tt.team_id) >= 5
  ORDER BY teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_partners(TEXT, DATE, TEXT) TO anon;

-- ─── 9. Pokemon detail — matchups ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_matchups(p_species TEXT, p_since DATE DEFAULT NULL, p_mode TEXT DEFAULT 'all')
RETURNS TABLE (opponent_species TEXT, matches BIGINT, wins BIGINT, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  tc_phases AS (
    SELECT tournament_id, MAX(phase) AS max_phase
    FROM matches WHERE phase IS NOT NULL
    GROUP BY tournament_id HAVING COUNT(DISTINCT phase) > 1
  ),
  target_matches AS (
    SELECT DISTINCT mp.match_id, mp.team_id AS target_team, mp.score AS target_score
    FROM match_participants mp
    JOIN teams t ON t.id = mp.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN matches mf ON mf.id = mp.match_id
    LEFT JOIN tc_phases tcp ON tcp.tournament_id = mf.tournament_id AND mf.phase = tcp.max_phase
    WHERE tour.format = 'M-A'
      AND (p_since IS NULL OR tour.date >= p_since)
      AND EXISTS (
        SELECT 1 FROM pokemon_sets ps
        WHERE ps.team_id = mp.team_id AND LOWER(ps.species) = LOWER(p_species)
      )
      AND (p_mode = 'all' OR tcp.max_phase IS NOT NULL)
  ),
  opponent_info AS (
    SELECT DISTINCT tm.match_id, tm.target_score, mp.team_id AS opp_team
    FROM target_matches tm
    JOIN match_participants mp ON mp.match_id = tm.match_id AND mp.team_id != tm.target_team
  ),
  matchup_by_species AS (
    SELECT DISTINCT oi.match_id, ps.species AS opp_species, oi.target_score
    FROM opponent_info oi
    JOIN pokemon_sets ps ON ps.team_id = oi.opp_team
  )
  SELECT
    opp_species AS opponent_species,
    COUNT(*)::BIGINT AS matches,
    SUM(target_score)::BIGINT AS wins,
    ROUND(SUM(target_score) * 100.0 / NULLIF(COUNT(*), 0), 2) AS win_rate
  FROM matchup_by_species
  GROUP BY opp_species
  HAVING COUNT(*) >= 10
  ORDER BY matches DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_matchups(TEXT, DATE, TEXT) TO anon;

-- ─── 10. Metagame summary ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_metagame_summary()
RETURNS TABLE (
  unique_players  BIGINT,
  total_tournaments BIGINT,
  total_teams     BIGINT,
  total_matches   BIGINT,
  date_start      DATE,
  date_end        DATE
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    (SELECT COUNT(DISTINCT tm.player_id)
     FROM teams tm JOIN tournaments t ON t.id = tm.tournament_id
     WHERE t.format = 'M-A') AS unique_players,
    (SELECT COUNT(*) FROM tournaments WHERE format = 'M-A') AS total_tournaments,
    (SELECT COUNT(*) FROM teams tm JOIN tournaments t ON t.id = tm.tournament_id
     WHERE t.format = 'M-A') AS total_teams,
    (SELECT COUNT(*) FROM matches m JOIN tournaments t ON t.id = m.tournament_id
     WHERE t.format = 'M-A') AS total_matches,
    (SELECT MIN(date)::DATE FROM tournaments WHERE format = 'M-A') AS date_start,
    (SELECT MAX(date)::DATE FROM tournaments WHERE format = 'M-A') AS date_end
$$;
GRANT EXECUTE ON FUNCTION get_metagame_summary() TO anon;

-- ─── 11. Tournaments list ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tournaments()
RETURNS TABLE (
  id         TEXT,
  name       TEXT,
  date       DATE,
  format     TEXT,
  attendees  BIGINT,
  winner     TEXT,
  winner_id  BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    t.id,
    t.name,
    t.date::DATE,
    t.format,
    COUNT(DISTINCT tm.id) AS attendees,
    p.name AS winner,
    p.id   AS winner_id
  FROM tournaments t
  LEFT JOIN teams tm ON tm.tournament_id = t.id
  LEFT JOIN tournament_standings ts ON ts.tournament_id = t.id AND ts.placing = 1
  LEFT JOIN players p ON p.id = ts.player_id
  WHERE t.format = 'M-A'
  GROUP BY t.id, t.name, t.date, t.format, p.name, p.id
  ORDER BY t.date DESC
$$;
GRANT EXECUTE ON FUNCTION get_tournaments() TO anon;

-- ─── 12. Players list ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_players()
RETURNS TABLE (
  id           BIGINT,
  name         TEXT,
  country      TEXT,
  tournaments  BIGINT,
  wins         BIGINT,
  top_cuts     BIGINT,
  best_placing INTEGER,
  win_rate     NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH ma_standings AS (
    SELECT ts.player_id, ts.placing, ts.wins, ts.losses
    FROM tournament_standings ts
    JOIN tournaments t ON t.id = ts.tournament_id
    WHERE t.format = 'M-A'
  )
  SELECT
    p.id,
    p.name,
    p.country,
    COUNT(*)                                               AS tournaments,
    COUNT(CASE WHEN s.placing = 1 THEN 1 END)             AS wins,
    COUNT(CASE WHEN s.placing <= 8 THEN 1 END)            AS top_cuts,
    MIN(s.placing)                                         AS best_placing,
    ROUND(
      100.0 * SUM(s.wins)::NUMERIC /
      NULLIF(SUM(s.wins) + SUM(s.losses), 0)
    , 1)                                                   AS win_rate
  FROM players p
  JOIN ma_standings s ON s.player_id = p.id
  GROUP BY p.id, p.name, p.country
  ORDER BY tournaments DESC, wins DESC
$$;
GRANT EXECUTE ON FUNCTION get_players() TO anon;

-- ─── 13. Tournament standings ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_tournament_standings(p_tournament_id TEXT)
RETURNS TABLE (
  player_id   BIGINT,
  player_name TEXT,
  country     TEXT,
  "placing"   INTEGER,
  wins        INTEGER,
  losses      INTEGER,
  ties        INTEGER,
  dropped     BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id     AS player_id,
    p.name   AS player_name,
    p.country,
    ts.placing,
    ts.wins,
    ts.losses,
    ts.ties,
    ts.dropped
  FROM tournament_standings ts
  JOIN players p ON p.id = ts.player_id
  WHERE ts.tournament_id = p_tournament_id
  ORDER BY ts.placing ASC NULLS LAST
$$;
GRANT EXECUTE ON FUNCTION get_tournament_standings(TEXT) TO anon;

-- ─── 14. Player career ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_player_career(p_player_id BIGINT)
RETURNS TABLE (
  tournament_id   TEXT,
  tournament_name TEXT,
  date            DATE,
  "placing"       INTEGER,
  wins            INTEGER,
  losses          INTEGER,
  ties            INTEGER,
  attendees       BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    t.id   AS tournament_id,
    t.name AS tournament_name,
    t.date::DATE,
    ts.placing,
    ts.wins,
    ts.losses,
    ts.ties,
    COUNT(DISTINCT tm.id) AS attendees
  FROM tournament_standings ts
  JOIN tournaments t ON t.id = ts.tournament_id
  JOIN teams tm ON tm.tournament_id = t.id
  WHERE ts.player_id = p_player_id
    AND t.format = 'M-A'
  GROUP BY t.id, t.name, t.date, ts.placing, ts.wins, ts.losses, ts.ties
  ORDER BY t.date DESC
$$;
GRANT EXECUTE ON FUNCTION get_player_career(BIGINT) TO anon;

-- ─── 15. Pokemon players ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_players(p_species TEXT)
RETURNS TABLE (
  player_id       BIGINT,
  player_name     TEXT,
  tournament_id   TEXT,
  tournament_name TEXT,
  date            DATE,
  "placing"       INTEGER,
  wins            INTEGER,
  losses          INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id    AS player_id,
    p.name  AS player_name,
    t.id    AS tournament_id,
    t.name  AS tournament_name,
    t.date::DATE,
    ts.placing,
    ts.wins,
    ts.losses
  FROM pokemon_sets ps
  JOIN teams tm ON tm.id = ps.team_id
  JOIN tournaments t ON t.id = tm.tournament_id
  JOIN players p ON p.id = tm.player_id
  JOIN tournament_standings ts ON ts.tournament_id = t.id AND ts.player_id = p.id
  WHERE LOWER(ps.species) = LOWER(p_species)
    AND t.format = 'M-A'
  ORDER BY ts.placing ASC NULLS LAST, t.date DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_players(TEXT) TO anon;

-- ─── 16. Pokemon trend ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_trend(p_species TEXT)
RETURNS TABLE (
  date DATE,
  usage_pct       NUMERIC,
  win_rate        NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH per_tournament AS (
    SELECT
      t.id   AS tid,
      t.date::DATE AS date,
      COUNT(DISTINCT tm.id)                        AS total_teams,
      COUNT(DISTINCT CASE WHEN LOWER(ps.species) = LOWER(p_species) THEN tm.id END) AS species_teams
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    LEFT JOIN pokemon_sets ps ON ps.team_id = tm.id
    WHERE t.format = 'M-A'
    GROUP BY t.id, t.date
  ),
  win_per_tournament AS (
    SELECT
      t.id AS tid,
      SUM(mp.score)::BIGINT AS wins,
      COUNT(mp.id)::BIGINT  AS total
    FROM match_participants mp
    JOIN teams tm ON tm.id = mp.team_id
    JOIN tournaments t ON t.id = tm.tournament_id
    JOIN pokemon_sets ps ON ps.team_id = tm.id AND LOWER(ps.species) = LOWER(p_species)
    WHERE t.format = 'M-A'
    GROUP BY t.id
  )
  SELECT
    pt.date,
    ROUND(100.0 * pt.species_teams / NULLIF(pt.total_teams, 0), 2) AS usage_pct,
    ROUND(100.0 * wt.wins / NULLIF(wt.total, 0), 2)                AS win_rate
  FROM per_tournament pt
  LEFT JOIN win_per_tournament wt ON wt.tid = pt.tid
  WHERE pt.species_teams > 0
  ORDER BY pt.date ASC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_trend(TEXT) TO anon;

-- ─── 17. Mega trend ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_trend(p_mega_item TEXT)
RETURNS TABLE (
  date DATE,
  usage_pct       NUMERIC,
  win_rate        NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH mega_teams AS (
    SELECT DISTINCT tm.tournament_id, tm.id AS team_id
    FROM teams tm
    JOIN pokemon_sets ps ON ps.team_id = tm.id
    JOIN canonical_mega_items() ci ON TRUE
    WHERE LOWER(ps.item) = LOWER(ci.item)
  ),
  per_tournament AS (
    SELECT
      t.id   AS tid,
      t.date::DATE AS date,
      COUNT(DISTINCT mt.team_id)                           AS total_mega_teams,
      COUNT(DISTINCT CASE WHEN LOWER(ps.item) = LOWER(p_mega_item) THEN tm.id END) AS item_teams
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    JOIN mega_teams mt ON mt.tournament_id = t.id AND mt.team_id = tm.id
    LEFT JOIN pokemon_sets ps ON ps.team_id = tm.id
    WHERE t.format = 'M-A'
    GROUP BY t.id, t.date
  ),
  win_per_tournament AS (
    SELECT
      t.id AS tid,
      SUM(mp.score)::BIGINT AS wins,
      COUNT(mp.id)::BIGINT  AS total
    FROM match_participants mp
    JOIN teams tm ON tm.id = mp.team_id
    JOIN tournaments t ON t.id = tm.tournament_id
    JOIN pokemon_sets ps ON ps.team_id = tm.id AND LOWER(ps.item) = LOWER(p_mega_item)
    WHERE t.format = 'M-A'
    GROUP BY t.id
  )
  SELECT
    pt.date,
    ROUND(100.0 * pt.item_teams / NULLIF(pt.total_mega_teams, 0), 2) AS usage_pct,
    ROUND(100.0 * wt.wins / NULLIF(wt.total, 0), 2)                  AS win_rate
  FROM per_tournament pt
  LEFT JOIN win_per_tournament wt ON wt.tid = pt.tid
  WHERE pt.item_teams > 0
  ORDER BY pt.date ASC
$$;
GRANT EXECUTE ON FUNCTION get_mega_trend(TEXT) TO anon;

-- ─── 18. Nature trends ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_nature_trends(p_species TEXT)
RETURNS TABLE (
  nature          TEXT,
  date DATE,
  usage_pct       NUMERIC,
  win_rate        NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH species_teams AS (
    SELECT DISTINCT tm.tournament_id, tm.id AS team_id, ps.ability AS nature
    FROM teams tm
    JOIN pokemon_sets ps ON ps.team_id = tm.id
    JOIN tournaments t ON t.id = tm.tournament_id
    WHERE LOWER(ps.species) = LOWER(p_species)
      AND t.format = 'M-A'
      AND ps.ability IS NOT NULL
  )
  SELECT 'unknown'::TEXT AS nature, NULL::DATE AS date,
         0::NUMERIC AS usage_pct, 0::NUMERIC AS win_rate
  WHERE FALSE
$$;
GRANT EXECUTE ON FUNCTION get_nature_trends(TEXT) TO anon;

-- ─── 19. Pokemon spreads (stub — no EV data in schema yet) ───────────────────

CREATE OR REPLACE FUNCTION get_pokemon_spreads(p_species TEXT)
RETURNS TABLE (
  nature      TEXT,
  hp          INTEGER,
  atk         INTEGER,
  def         INTEGER,
  spa         INTEGER,
  spd         INTEGER,
  spe         INTEGER,
  usage_pct   NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULL::TEXT, NULL::INT, NULL::INT, NULL::INT, NULL::INT, NULL::INT, NULL::INT, NULL::NUMERIC
  WHERE FALSE
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_spreads(TEXT) TO anon;

-- ─── 20. Teams with rosters ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_teams_with_rosters(
  p_mode  TEXT    DEFAULT 'all',
  p_limit INTEGER DEFAULT 2000
)
RETURNS TABLE (
  tournament_id   TEXT,
  tournament_name TEXT,
  tournament_date DATE,
  "placing"       INTEGER,
  player_id       BIGINT,
  player_name     TEXT,
  country         TEXT,
  wins            INTEGER,
  losses          INTEGER,
  roster          JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  tc_teams AS (
    SELECT team_id FROM top_cut_teams_ma(NULL)
  ),
  team_rosters AS (
    SELECT
      ps.team_id,
      jsonb_agg(
        jsonb_build_object(
          'species', ps.species,
          'item',    COALESCE(ps.item, ''),
          'moves',   COALESCE(
            (SELECT jsonb_agg(m.move_name ORDER BY m.id)
             FROM moves m WHERE m.pokemon_set_id = ps.id),
            '[]'::jsonb
          )
        )
        ORDER BY ps.id
      ) AS roster
    FROM pokemon_sets ps
    WHERE NOT ps.invalid
    GROUP BY ps.team_id
  )
  SELECT
    ts.tournament_id,
    t.name           AS tournament_name,
    t.date::DATE     AS tournament_date,
    ts.placing,
    p.id             AS player_id,
    p.name           AS player_name,
    p.country,
    ts.wins,
    ts.losses,
    tr.roster
  FROM tournament_standings ts
  JOIN tournaments t ON t.id = ts.tournament_id
  JOIN players p ON p.id = ts.player_id
  JOIN team_rosters tr ON tr.team_id = ts.team_id
  LEFT JOIN tc_teams tc ON tc.team_id = ts.team_id
  WHERE t.format = 'M-A'
    AND (p_mode = 'all' OR tc.team_id IS NOT NULL)
  ORDER BY ts.placing ASC NULLS LAST, t.date DESC
  LIMIT p_limit
$$;
GRANT EXECUTE ON FUNCTION get_teams_with_rosters(TEXT, INTEGER) TO anon;
