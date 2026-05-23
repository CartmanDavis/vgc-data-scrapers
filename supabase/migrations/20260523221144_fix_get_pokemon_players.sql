-- Rewrite get_pokemon_players to return aggregated per-player stats.
-- Previous version returned one row per tournament entry (wrong shape for the UI).
-- New shape matches PokemonPlayerRow: player_id, player_name, country, flag, teams, win_rate, best_placing.
CREATE OR REPLACE FUNCTION get_pokemon_players(p_species TEXT)
RETURNS TABLE (
  player_id    BIGINT,
  player_name  TEXT,
  country      TEXT,
  flag         TEXT,
  teams        BIGINT,
  win_rate     NUMERIC,
  best_placing INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id                                                          AS player_id,
    p.name                                                        AS player_name,
    p.country,
    CASE
      WHEN p.country IS NOT NULL AND LENGTH(p.country) = 2
      THEN CHR(127397 + ASCII(UPPER(SUBSTRING(p.country, 1, 1))))
        || CHR(127397 + ASCII(UPPER(SUBSTRING(p.country, 2, 1))))
      ELSE NULL
    END                                                           AS flag,
    COUNT(DISTINCT tm.id)                                         AS teams,
    ROUND(
      100.0 * SUM(ts.wins)::NUMERIC /
      NULLIF(SUM(ts.wins) + SUM(ts.losses), 0)
    , 1)                                                          AS win_rate,
    MIN(ts.placing)                                               AS best_placing
  FROM pokemon_sets ps
  JOIN teams tm ON tm.id = ps.team_id
  JOIN tournaments t ON t.id = tm.tournament_id
  JOIN players p ON p.id = tm.player_id
  JOIN tournament_standings ts ON ts.tournament_id = t.id AND ts.player_id = p.id
  WHERE LOWER(ps.species) = LOWER(p_species)
    AND t.format = 'M-A'
  GROUP BY p.id, p.name, p.country
  ORDER BY teams DESC, best_placing ASC NULLS LAST
$$;
GRANT EXECUTE ON FUNCTION get_pokemon_players(TEXT) TO anon;
