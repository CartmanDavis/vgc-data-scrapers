-- Precompute species-vs-species matchup and partner data as materialized views.
-- Fixes get_pokemon_matchups and get_pokemon_partners timing out (>3s) for popular
-- Pokemon like Sneasler under concurrent load (issue #24). The functions now do a
-- simple indexed lookup on the MVs for the common default-parameter case; the
-- original join-heavy logic is kept as a fallback for filtered calls (p_since / p_mode).

-- ─── pokemon_matchups_mv ──────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS pokemon_matchups_mv AS
WITH
ma_mp AS (
  SELECT mp.match_id, mp.team_id, mp.score
  FROM match_participants mp
  JOIN teams t ON t.id = mp.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  WHERE tour.format = 'M-A'
),
-- Pair the two sides of every M-A match
match_sides AS (
  SELECT a.match_id, a.team_id AS team_a, a.score AS score_a, b.team_id AS team_b
  FROM ma_mp a
  JOIN ma_mp b ON b.match_id = a.match_id AND b.team_id != a.team_id
),
-- Expand to (match, target_species, score, opp_team); DISTINCT removes per-pokemon duplication
target_side AS (
  SELECT DISTINCT ms.match_id, ps.species AS target_species, ms.score_a AS target_score, ms.team_b AS opp_team
  FROM match_sides ms
  JOIN pokemon_sets ps ON ps.team_id = ms.team_a
),
-- Expand to (match, target_species, opponent_species, score); DISTINCT for same reason
matchup_pairs AS (
  SELECT DISTINCT ts.match_id, ts.target_species, ps.species AS opponent_species, ts.target_score
  FROM target_side ts
  JOIN pokemon_sets ps ON ps.team_id = ts.opp_team
)
SELECT
  target_species,
  opponent_species,
  COUNT(*)::BIGINT                                             AS matches,
  SUM(target_score)::BIGINT                                   AS wins,
  ROUND(SUM(target_score) * 100.0 / NULLIF(COUNT(*), 0), 2) AS win_rate
FROM matchup_pairs
GROUP BY target_species, opponent_species
HAVING COUNT(*) >= 10
ORDER BY target_species, matches DESC;

-- Unique index required for CONCURRENTLY refresh; also the primary lookup key
CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_matchups_mv_pk
  ON pokemon_matchups_mv(target_species, opponent_species);

-- ─── pokemon_partners_mv ─────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS pokemon_partners_mv AS
WITH
-- Every (species, team) pair in M-A
ma_team_species AS (
  SELECT ps.species, t.id AS team_id
  FROM pokemon_sets ps
  JOIN teams t ON t.id = ps.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  WHERE tour.format = 'M-A'
),
-- Denominator for usage_pct: teams containing each species
species_total AS (
  SELECT species, COUNT(DISTINCT team_id)::numeric AS n
  FROM ma_team_species
  GROUP BY species
),
-- All (species_a, species_b, team_id) combinations sharing a team
duo_teams AS (
  SELECT a.species AS species_a, b.species AS species_b, a.team_id
  FROM ma_team_species a
  JOIN ma_team_species b ON b.team_id = a.team_id AND b.species != a.species
),
-- All M-A match results (for win-rate denominator)
ma_mp AS (
  SELECT mp.team_id, mp.score
  FROM match_participants mp
  JOIN teams t ON t.id = mp.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  WHERE tour.format = 'M-A'
)
SELECT
  dt.species_a                                                          AS species,
  dt.species_b                                                          AS partner_species,
  COUNT(DISTINCT dt.team_id)::BIGINT                                    AS teams,
  ROUND(COUNT(DISTINCT dt.team_id) * 100.0 / st.n, 2)                  AS usage_pct,
  ROUND(SUM(mp.score) * 100.0 / NULLIF(COUNT(mp.score), 0), 2)         AS win_rate
FROM duo_teams dt
JOIN species_total st ON st.species = dt.species_a
JOIN ma_mp mp ON mp.team_id = dt.team_id
GROUP BY dt.species_a, dt.species_b, st.n
HAVING COUNT(DISTINCT dt.team_id) >= 5
ORDER BY species, teams DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_partners_mv_pk
  ON pokemon_partners_mv(species, partner_species);

-- ─── Update refresh function ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY pokemon_usage_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY pokemon_matchups_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY pokemon_partners_mv;
$$;
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO service_role;

-- ─── Rewrite get_pokemon_matchups ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_matchups(p_species TEXT, p_since DATE DEFAULT NULL, p_mode TEXT DEFAULT 'all')
RETURNS TABLE (opponent_species TEXT, matches BIGINT, wins BIGINT, win_rate NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Fast path: MV lookup (handles the only call pattern the UI uses)
  IF p_since IS NULL AND p_mode = 'all' THEN
    RETURN QUERY
      SELECT mv.opponent_species, mv.matches, mv.wins, mv.win_rate
      FROM pokemon_matchups_mv mv
      WHERE LOWER(mv.target_species) = LOWER(p_species)
      ORDER BY mv.matches DESC;
    RETURN;
  END IF;

  -- Fallback: original join-heavy query for filtered calls
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

-- ─── Rewrite get_pokemon_partners ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pokemon_partners(p_species TEXT, p_since DATE DEFAULT NULL, p_mode TEXT DEFAULT 'all')
RETURNS TABLE (partner_species TEXT, teams BIGINT, usage_pct NUMERIC, win_rate NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Fast path: MV lookup
  IF p_since IS NULL AND p_mode = 'all' THEN
    RETURN QUERY
      SELECT mv.partner_species, mv.teams, mv.usage_pct, mv.win_rate
      FROM pokemon_partners_mv mv
      WHERE LOWER(mv.species) = LOWER(p_species)
      ORDER BY mv.teams DESC;
    RETURN;
  END IF;

  -- Fallback: original query for filtered calls
  RETURN QUERY
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
    ps.species                                                            AS partner_species,
    COUNT(DISTINCT tt.team_id)                                            AS teams,
    ROUND(COUNT(DISTINCT tt.team_id) * 100.0 / total.n, 2)              AS usage_pct,
    ROUND(SUM(fmp.score) * 100.0 / NULLIF(COUNT(fmp.score), 0), 2)      AS win_rate
  FROM target_teams tt
  JOIN pokemon_sets ps ON ps.team_id = tt.team_id
  JOIN filtered_mp fmp ON fmp.team_id = tt.team_id
  CROSS JOIN total
  WHERE LOWER(ps.species) != LOWER(p_species)
  GROUP BY ps.species, total.n
  HAVING COUNT(DISTINCT tt.team_id) >= 5
  ORDER BY teams DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_partners(TEXT, DATE, TEXT) TO anon;
