-- VGC Usage Stats — PostgreSQL RPC functions for Supabase
-- Run in the Supabase SQL editor (safe to re-run; all are CREATE OR REPLACE).
-- After running, execute: NOTIFY pgrst, 'reload schema';

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
  SELECT DISTINCT mp.team_id
  FROM match_participants mp
  JOIN matches m  ON m.id  = mp.match_id
  JOIN tournaments t ON t.id = m.tournament_id
  WHERE t.format = 'M-A'
    AND (p_since IS NULL OR t.date >= p_since)
    AND m.phase = (SELECT MAX(m2.phase) FROM matches m2 WHERE m2.tournament_id = t.id)
    AND (SELECT COUNT(DISTINCT m3.phase) FROM matches m3 WHERE m3.tournament_id = t.id) > 1
$$;
GRANT EXECUTE ON FUNCTION top_cut_teams_ma(DATE) TO anon;

-- ─── 1. Pokemon usage ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_usage(p_since DATE DEFAULT NULL)
RETURNS TABLE (
  species          TEXT,
  is_mega          BOOLEAN,
  teams            BIGINT,
  usage_pct        NUMERIC,
  win_rate         NUMERIC,
  four_plus_teams  BIGINT,
  four_plus_usage  NUMERIC,
  four_plus_wr     NUMERIC,
  top_cut_teams    BIGINT,
  top_cut_usage    NUMERIC,
  top_cut_wr       NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  total AS (
    SELECT COUNT(*)::numeric AS n
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since)
  ),
  four_plus_total AS (
    SELECT COUNT(*)::numeric AS n
    FROM teams t
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since) AND ts.wins >= 4
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
  four_plus AS (
    SELECT
      ps.species,
      COUNT(DISTINCT t.id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    JOIN tournament_standings ts ON ts.tournament_id = t.tournament_id AND ts.player_id = t.player_id
    JOIN match_participants mp ON mp.team_id = t.id
    WHERE tour.format = 'M-A' AND (p_since IS NULL OR tour.date >= p_since) AND ts.wins >= 4
    GROUP BY ps.species
  ),
  top_cut AS (
    SELECT
      ps.species,
      COUNT(DISTINCT t.id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN top_cut_teams_ma(p_since) tc ON tc.team_id = t.id
    JOIN match_participants mp ON mp.team_id = t.id
    GROUP BY ps.species
  )
  SELECT
    b.species, b.is_mega, b.teams,
    ROUND(b.teams * 100.0 / total.n, 2),
    b.win_rate,
    COALESCE(fp.teams, 0),
    ROUND(COALESCE(fp.teams, 0) * 100.0 / four_plus_total.n, 2),
    fp.win_rate,
    COALESCE(tc.teams, 0),
    ROUND(COALESCE(tc.teams, 0) * 100.0 / top_cut_total.n, 2),
    tc.win_rate
  FROM base b
  CROSS JOIN total CROSS JOIN four_plus_total CROSS JOIN top_cut_total
  LEFT JOIN four_plus fp ON fp.species = b.species
  LEFT JOIN top_cut   tc ON tc.species = b.species
  ORDER BY b.teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_usage(DATE) TO anon;

-- ─── 2. Mega usage ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_usage(p_since DATE DEFAULT NULL)
RETURNS TABLE (
  pokemon          TEXT,
  teams            BIGINT,
  usage_pct        NUMERIC,
  win_rate         NUMERIC,
  four_plus_teams  BIGINT,
  four_plus_usage  NUMERIC,
  four_plus_wr     NUMERIC,
  top_cut_teams    BIGINT,
  top_cut_usage    NUMERIC,
  top_cut_wr       NUMERIC
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
  total_mega     AS (SELECT COUNT(DISTINCT team_id)::numeric AS n FROM team_mega),
  four_plus_mega AS (
    SELECT COUNT(DISTINCT tm.team_id)::numeric AS n
    FROM team_mega tm
    JOIN tournament_standings ts ON ts.tournament_id = tm.tournament_id AND ts.player_id = tm.player_id
    WHERE ts.wins >= 4
  ),
  top_cut_mega AS (
    SELECT COUNT(DISTINCT tm.team_id)::numeric AS n
    FROM team_mega tm JOIN top_cut_teams_ma(p_since) tc ON tc.team_id = tm.team_id
  ),
  base AS (
    SELECT tm.item AS pokemon, COUNT(DISTINCT tm.team_id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM team_mega tm JOIN match_participants mp ON mp.team_id = tm.team_id
    GROUP BY tm.item
  ),
  four_plus AS (
    SELECT tm.item AS pokemon, COUNT(DISTINCT tm.team_id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM team_mega tm
    JOIN tournament_standings ts ON ts.tournament_id = tm.tournament_id AND ts.player_id = tm.player_id
    JOIN match_participants mp ON mp.team_id = tm.team_id
    WHERE ts.wins >= 4
    GROUP BY tm.item
  ),
  top_cut AS (
    SELECT tm.item AS pokemon, COUNT(DISTINCT tm.team_id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM team_mega tm JOIN top_cut_teams_ma(p_since) tc ON tc.team_id = tm.team_id
    JOIN match_participants mp ON mp.team_id = tm.team_id
    GROUP BY tm.item
  )
  SELECT
    b.pokemon, b.teams,
    ROUND(b.teams * 100.0 / total_mega.n, 2), b.win_rate,
    COALESCE(fp.teams, 0), ROUND(COALESCE(fp.teams, 0) * 100.0 / four_plus_mega.n, 2), fp.win_rate,
    COALESCE(tc.teams, 0), ROUND(COALESCE(tc.teams, 0) * 100.0 / top_cut_mega.n, 2), tc.win_rate
  FROM base b
  CROSS JOIN total_mega CROSS JOIN four_plus_mega CROSS JOIN top_cut_mega
  LEFT JOIN four_plus fp ON fp.pokemon = b.pokemon
  LEFT JOIN top_cut   tc ON tc.pokemon = b.pokemon
  ORDER BY b.teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_mega_usage(DATE) TO anon;

-- ─── 3. Mega H2H ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_h2h(p_min_matches INT DEFAULT 20, p_since DATE DEFAULT NULL)
RETURNS TABLE (
  mega1 TEXT, mega2 TEXT,
  matches BIGINT, mega1_wins BIGINT, mega2_wins BIGINT, mega1_wr NUMERIC,
  four_plus_matches BIGINT, four_plus_mega1_wins BIGINT, four_plus_mega2_wins BIGINT, four_plus_mega1_wr NUMERIC,
  top_cut_matches BIGINT, top_cut_mega1_wins BIGINT, top_cut_mega2_wins BIGINT, top_cut_mega1_wr NUMERIC
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
  matchups AS (
    SELECT mp1.team_id AS t1, mp2.team_id AS t2, mp1.score AS s1, mp2.score AS s2, m.tournament_id
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
      mu.t1, mu.t2, mu.tournament_id
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
  four_plus AS (
    SELECT mm.mega1, mm.mega2, COUNT(*) AS matches,
      SUM(mm.score1) AS mega1_wins, SUM(mm.score2) AS mega2_wins,
      ROUND(SUM(mm.score1) * 100.0 / NULLIF(COUNT(*), 0), 2) AS mega1_wr
    FROM mega_matchups mm
    JOIN tournament_standings ts1 ON ts1.tournament_id = mm.tournament_id AND ts1.team_id = mm.t1
    JOIN tournament_standings ts2 ON ts2.tournament_id = mm.tournament_id AND ts2.team_id = mm.t2
    WHERE ts1.wins >= 4 AND ts2.wins >= 4
    GROUP BY mm.mega1, mm.mega2
  ),
  top_cut AS (
    SELECT mm.mega1, mm.mega2, COUNT(*) AS matches,
      SUM(mm.score1) AS mega1_wins, SUM(mm.score2) AS mega2_wins,
      ROUND(SUM(mm.score1) * 100.0 / NULLIF(COUNT(*), 0), 2) AS mega1_wr
    FROM mega_matchups mm
    JOIN top_cut_teams_ma(p_since) tc1 ON tc1.team_id = mm.t1
    JOIN top_cut_teams_ma(p_since) tc2 ON tc2.team_id = mm.t2
    GROUP BY mm.mega1, mm.mega2
  )
  SELECT
    b.mega1, b.mega2, b.matches, b.mega1_wins, b.mega2_wins, b.mega1_wr,
    COALESCE(fp.matches, 0), COALESCE(fp.mega1_wins, 0), COALESCE(fp.mega2_wins, 0), fp.mega1_wr,
    COALESCE(tc.matches, 0), COALESCE(tc.mega1_wins, 0), COALESCE(tc.mega2_wins, 0), tc.mega1_wr
  FROM base b
  LEFT JOIN four_plus fp ON fp.mega1 = b.mega1 AND fp.mega2 = b.mega2
  LEFT JOIN top_cut   tc ON tc.mega1 = b.mega1 AND tc.mega2 = b.mega2
  WHERE b.matches >= p_min_matches
  ORDER BY b.matches DESC
$$;
GRANT EXECUTE ON FUNCTION get_mega_h2h(INT, DATE) TO anon;

-- ─── 4. Mega combos ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mega_combos(p_min_teams INT DEFAULT 10, p_since DATE DEFAULT NULL)
RETURNS TABLE (
  combo TEXT, teams BIGINT, usage_pct NUMERIC, win_rate NUMERIC,
  four_plus_teams BIGINT, four_plus_usage NUMERIC, four_plus_wr NUMERIC,
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
  total_mega     AS (SELECT COUNT(DISTINCT team_id)::numeric AS n FROM team_combos),
  four_plus_total AS (
    SELECT COUNT(DISTINCT tc.team_id)::numeric AS n
    FROM team_combos tc
    JOIN tournament_standings ts ON ts.tournament_id = tc.tournament_id AND ts.player_id = tc.player_id
    WHERE ts.wins >= 4
  ),
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
  four_plus AS (
    SELECT tc.combo, COUNT(DISTINCT tc.team_id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM team_combos tc
    JOIN tournament_standings ts ON ts.tournament_id = tc.tournament_id AND ts.player_id = tc.player_id
    JOIN match_participants mp ON mp.team_id = tc.team_id
    WHERE ts.wins >= 4 GROUP BY tc.combo
  ),
  top_cut AS (
    SELECT tc.combo, COUNT(DISTINCT tc.team_id) AS teams,
      ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
    FROM team_combos tc
    JOIN top_cut_teams_ma(p_since) tct ON tct.team_id = tc.team_id
    JOIN match_participants mp ON mp.team_id = tc.team_id
    GROUP BY tc.combo
  )
  SELECT
    b.combo, b.teams, ROUND(b.teams * 100.0 / total_mega.n, 2), b.win_rate,
    COALESCE(fp.teams, 0), ROUND(COALESCE(fp.teams, 0) * 100.0 / four_plus_total.n, 2), fp.win_rate,
    COALESCE(tc.teams, 0), ROUND(COALESCE(tc.teams, 0) * 100.0 / top_cut_total.n, 2), tc.win_rate
  FROM base b
  CROSS JOIN total_mega CROSS JOIN four_plus_total CROSS JOIN top_cut_total
  LEFT JOIN four_plus fp ON fp.combo = b.combo
  LEFT JOIN top_cut   tc ON tc.combo = b.combo
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

CREATE OR REPLACE FUNCTION get_pokemon_moves(p_species TEXT, p_since DATE DEFAULT NULL)
RETURNS TABLE (move_name TEXT, teams BIGINT, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT MAX(m.move_name) AS move_name,
    COUNT(DISTINCT t.id) AS teams,
    ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
  FROM moves m
  JOIN pokemon_sets ps ON ps.id = m.pokemon_set_id
  JOIN teams t ON t.id = ps.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  JOIN match_participants mp ON mp.team_id = t.id
  WHERE tour.format = 'M-A'
    AND LOWER(ps.species) = LOWER(p_species)
    AND (p_since IS NULL OR tour.date >= p_since)
  GROUP BY LOWER(m.move_name)
  HAVING COUNT(DISTINCT t.id) >= 3
  ORDER BY teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_moves(TEXT, DATE) TO anon;

-- ─── 7. Pokemon detail — items ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_items(p_species TEXT, p_since DATE DEFAULT NULL)
RETURNS TABLE (item TEXT, teams BIGINT, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(NULLIF(ps.item, ''), 'No Item') AS item,
    COUNT(DISTINCT t.id) AS teams,
    ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
  FROM pokemon_sets ps
  JOIN teams t ON t.id = ps.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  JOIN match_participants mp ON mp.team_id = t.id
  WHERE tour.format = 'M-A'
    AND LOWER(ps.species) = LOWER(p_species)
    AND (p_since IS NULL OR tour.date >= p_since)
  GROUP BY LOWER(ps.item), COALESCE(NULLIF(ps.item, ''), 'No Item')
  HAVING COUNT(DISTINCT t.id) >= 3
  ORDER BY teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_items(TEXT, DATE) TO anon;

-- ─── 8. Pokemon detail — partners ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_partners(p_species TEXT, p_since DATE DEFAULT NULL)
RETURNS TABLE (partner_species TEXT, teams BIGINT, usage_pct NUMERIC, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  target_teams AS (
    SELECT DISTINCT t.id AS team_id
    FROM pokemon_sets ps
    JOIN teams t ON t.id = ps.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    WHERE tour.format = 'M-A'
      AND LOWER(ps.species) = LOWER(p_species)
      AND (p_since IS NULL OR tour.date >= p_since)
  ),
  total AS (SELECT COUNT(*)::numeric AS n FROM target_teams)
  SELECT
    ps.species AS partner_species,
    COUNT(DISTINCT tt.team_id) AS teams,
    ROUND(COUNT(DISTINCT tt.team_id) * 100.0 / total.n, 2) AS usage_pct,
    ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2) AS win_rate
  FROM target_teams tt
  JOIN pokemon_sets ps ON ps.team_id = tt.team_id
  JOIN match_participants mp ON mp.team_id = tt.team_id
  CROSS JOIN total
  WHERE LOWER(ps.species) != LOWER(p_species)
  GROUP BY ps.species, total.n
  HAVING COUNT(DISTINCT tt.team_id) >= 5
  ORDER BY teams DESC
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_partners(TEXT, DATE) TO anon;

-- ─── 9. Pokemon detail — matchups ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_matchups(p_species TEXT, p_since DATE DEFAULT NULL)
RETURNS TABLE (opponent_species TEXT, matches BIGINT, wins BIGINT, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  target_matches AS (
    SELECT DISTINCT mp.match_id, mp.team_id AS target_team, mp.score AS target_score
    FROM match_participants mp
    JOIN teams t ON t.id = mp.team_id
    JOIN tournaments tour ON tour.id = t.tournament_id
    WHERE tour.format = 'M-A'
      AND (p_since IS NULL OR tour.date >= p_since)
      AND EXISTS (
        SELECT 1 FROM pokemon_sets ps
        WHERE ps.team_id = mp.team_id AND LOWER(ps.species) = LOWER(p_species)
      )
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
GRANT EXECUTE ON FUNCTION get_pokemon_matchups(TEXT, DATE) TO anon;

NOTIFY pgrst, 'reload schema';
