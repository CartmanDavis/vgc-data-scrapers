-- Add weekly per-item trend functions for moves, items, partners, and matchups.
-- The frontend MultiTrendChart was falling back to the species-level trend for all
-- series because per-item trend data didn't exist; these functions fix that.
--
-- Also promotes pokemon_matchups_mv to week-level granularity so matchup trends
-- can be served from the MV (fast indexed lookup) instead of a live join.

-- ─── Rebuild matchups MV with week_start dimension ───────────────────────────
-- The summary query (get_pokemon_matchups) just aggregates across weeks.
-- The new trend query (get_pokemon_matchup_trends) reads per-week rows directly.

DROP MATERIALIZED VIEW IF EXISTS pokemon_matchups_mv CASCADE;

CREATE MATERIALIZED VIEW pokemon_matchups_mv AS
WITH
ma_mp AS (
  SELECT mp.match_id, mp.team_id, mp.score,
         DATE_TRUNC('week', tour.date)::DATE AS week_start
  FROM match_participants mp
  JOIN teams t ON t.id = mp.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  WHERE tour.format = 'M-A'
),
match_sides AS (
  SELECT a.match_id, a.week_start, a.team_id AS team_a, a.score AS score_a, b.team_id AS team_b
  FROM ma_mp a
  JOIN ma_mp b ON b.match_id = a.match_id AND b.team_id != a.team_id
),
target_side AS (
  SELECT DISTINCT ms.match_id, ms.week_start, ps.species AS target_species,
                  ms.score_a AS target_score, ms.team_b AS opp_team
  FROM match_sides ms
  JOIN pokemon_sets ps ON ps.team_id = ms.team_a
),
matchup_pairs AS (
  SELECT DISTINCT ts.match_id, ts.week_start, ts.target_species,
                  ps.species AS opponent_species, ts.target_score
  FROM target_side ts
  JOIN pokemon_sets ps ON ps.team_id = ts.opp_team
)
SELECT
  target_species,
  opponent_species,
  week_start,
  COUNT(*)::BIGINT                                             AS matches,
  SUM(target_score)::BIGINT                                   AS wins,
  ROUND(SUM(target_score) * 100.0 / NULLIF(COUNT(*), 0), 2) AS win_rate
FROM matchup_pairs
GROUP BY target_species, opponent_species, week_start
ORDER BY target_species, week_start, matches DESC;

CREATE UNIQUE INDEX idx_pokemon_matchups_mv_pk
  ON pokemon_matchups_mv(target_species, opponent_species, week_start);

-- Fast non-week lookup for get_pokemon_matchups
CREATE INDEX idx_pokemon_matchups_mv_species
  ON pokemon_matchups_mv(LOWER(target_species));

-- ─── Update get_pokemon_matchups to aggregate from week-level MV ─────────────

CREATE OR REPLACE FUNCTION get_pokemon_matchups(p_species TEXT, p_since DATE DEFAULT NULL, p_mode TEXT DEFAULT 'all')
RETURNS TABLE (opponent_species TEXT, matches BIGINT, wins BIGINT, win_rate NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF p_since IS NULL AND p_mode = 'all' THEN
    RETURN QUERY
      SELECT
        mv.opponent_species,
        SUM(mv.matches)::BIGINT,
        SUM(mv.wins)::BIGINT,
        ROUND(SUM(mv.wins) * 100.0 / NULLIF(SUM(mv.matches), 0), 2)
      FROM pokemon_matchups_mv mv
      WHERE LOWER(mv.target_species) = LOWER(p_species)
      GROUP BY mv.opponent_species
      HAVING SUM(mv.matches) >= 10
      ORDER BY SUM(mv.matches) DESC;
    RETURN;
  END IF;

  -- Fallback: original live query for filtered calls
  RETURN QUERY
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
    opp_species                                                           AS opponent_species,
    COUNT(*)::BIGINT                                                      AS matches,
    SUM(target_score)::BIGINT                                             AS wins,
    ROUND(SUM(target_score) * 100.0 / NULLIF(COUNT(*), 0), 2)            AS win_rate
  FROM matchup_by_species
  GROUP BY opp_species
  HAVING COUNT(*) >= 10
  ORDER BY matches DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_matchups(TEXT, DATE, TEXT) TO anon;

-- ─── get_pokemon_matchup_trends ──────────────────────────────────────────────
-- Weekly win rate for each opponent species, read directly from the week-level MV.
-- usage_pct is set to 0 (not meaningful for matchups; chart defaults to win rate).

CREATE OR REPLACE FUNCTION get_pokemon_matchup_trends(p_species TEXT)
RETURNS TABLE (opponent_species TEXT, date DATE, usage_pct NUMERIC, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    mv.opponent_species,
    mv.week_start                                                        AS date,
    0::NUMERIC                                                           AS usage_pct,
    ROUND(SUM(mv.wins) * 100.0 / NULLIF(SUM(mv.matches), 0), 2)        AS win_rate
  FROM pokemon_matchups_mv mv
  WHERE LOWER(mv.target_species) = LOWER(p_species)
  GROUP BY mv.opponent_species, mv.week_start
  HAVING SUM(mv.matches) >= 5
  ORDER BY mv.opponent_species, mv.week_start
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_matchup_trends(TEXT) TO anon;

-- ─── get_pokemon_move_trends ─────────────────────────────────────────────────
-- Weekly usage % and win rate for each move used by the species.
-- usage_pct denominator = teams with the species in that week.

CREATE OR REPLACE FUNCTION get_pokemon_move_trends(p_species TEXT)
RETURNS TABLE (move_name TEXT, date DATE, usage_pct NUMERIC, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH species_per_week AS (
    SELECT
      DATE_TRUNC('week', t.date)::DATE AS week_start,
      COUNT(DISTINCT tm.id)            AS n
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    JOIN pokemon_sets ps ON ps.team_id = tm.id AND LOWER(ps.species) = LOWER(p_species)
    WHERE t.format = 'M-A'
    GROUP BY 1
  ),
  move_per_week AS (
    SELECT
      DATE_TRUNC('week', t.date)::DATE AS week_start,
      mv.move_name,
      COUNT(DISTINCT tm.id)            AS move_teams,
      SUM(mp.score)::BIGINT            AS wins,
      COUNT(mp.id)::BIGINT             AS total
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    JOIN pokemon_sets ps ON ps.team_id = tm.id AND LOWER(ps.species) = LOWER(p_species)
    JOIN moves mv ON mv.pokemon_set_id = ps.id
    JOIN match_participants mp ON mp.team_id = tm.id
    WHERE t.format = 'M-A'
    GROUP BY 1, mv.move_name
  )
  SELECT
    mpw.move_name,
    mpw.week_start                                                        AS date,
    ROUND(100.0 * mpw.move_teams / NULLIF(spw.n, 0), 2)                 AS usage_pct,
    ROUND(100.0 * mpw.wins       / NULLIF(mpw.total, 0), 2)             AS win_rate
  FROM move_per_week mpw
  JOIN species_per_week spw ON spw.week_start = mpw.week_start
  ORDER BY mpw.move_name, mpw.week_start
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_move_trends(TEXT) TO anon;

-- ─── get_pokemon_item_trends ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_item_trends(p_species TEXT)
RETURNS TABLE (item TEXT, date DATE, usage_pct NUMERIC, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH species_per_week AS (
    SELECT
      DATE_TRUNC('week', t.date)::DATE AS week_start,
      COUNT(DISTINCT tm.id)            AS n
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    JOIN pokemon_sets ps ON ps.team_id = tm.id AND LOWER(ps.species) = LOWER(p_species)
    WHERE t.format = 'M-A'
    GROUP BY 1
  ),
  item_per_week AS (
    SELECT
      DATE_TRUNC('week', t.date)::DATE AS week_start,
      ps.item,
      COUNT(DISTINCT tm.id)            AS item_teams,
      SUM(mp.score)::BIGINT            AS wins,
      COUNT(mp.id)::BIGINT             AS total
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    JOIN pokemon_sets ps ON ps.team_id = tm.id AND LOWER(ps.species) = LOWER(p_species)
    JOIN match_participants mp ON mp.team_id = tm.id
    WHERE t.format = 'M-A'
      AND ps.item IS NOT NULL AND ps.item <> ''
    GROUP BY 1, ps.item
  )
  SELECT
    ipw.item,
    ipw.week_start                                                        AS date,
    ROUND(100.0 * ipw.item_teams / NULLIF(spw.n, 0), 2)                 AS usage_pct,
    ROUND(100.0 * ipw.wins       / NULLIF(ipw.total, 0), 2)             AS win_rate
  FROM item_per_week ipw
  JOIN species_per_week spw ON spw.week_start = ipw.week_start
  ORDER BY ipw.item, ipw.week_start
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_item_trends(TEXT) TO anon;

-- ─── get_pokemon_partner_trends ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_partner_trends(p_species TEXT)
RETURNS TABLE (partner_species TEXT, date DATE, usage_pct NUMERIC, win_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH species_per_week AS (
    SELECT
      DATE_TRUNC('week', t.date)::DATE AS week_start,
      COUNT(DISTINCT tm.id)            AS n
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    JOIN pokemon_sets ps ON ps.team_id = tm.id AND LOWER(ps.species) = LOWER(p_species)
    WHERE t.format = 'M-A'
    GROUP BY 1
  ),
  partner_per_week AS (
    SELECT
      DATE_TRUNC('week', t.date)::DATE AS week_start,
      ps2.species                      AS partner_species,
      COUNT(DISTINCT tm.id)            AS partner_teams,
      SUM(mp.score)::BIGINT            AS wins,
      COUNT(mp.id)::BIGINT             AS total
    FROM tournaments t
    JOIN teams tm ON tm.tournament_id = t.id
    JOIN pokemon_sets ps  ON ps.team_id  = tm.id AND LOWER(ps.species)  = LOWER(p_species)
    JOIN pokemon_sets ps2 ON ps2.team_id = tm.id AND LOWER(ps2.species) != LOWER(p_species)
    JOIN match_participants mp ON mp.team_id = tm.id
    WHERE t.format = 'M-A'
    GROUP BY 1, ps2.species
  )
  SELECT
    ppw.partner_species,
    ppw.week_start                                                        AS date,
    ROUND(100.0 * ppw.partner_teams / NULLIF(spw.n, 0), 2)              AS usage_pct,
    ROUND(100.0 * ppw.wins          / NULLIF(ppw.total, 0), 2)          AS win_rate
  FROM partner_per_week ppw
  JOIN species_per_week spw ON spw.week_start = ppw.week_start
  WHERE ppw.partner_teams >= 3
  ORDER BY ppw.partner_species, ppw.week_start
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_partner_trends(TEXT) TO anon;
