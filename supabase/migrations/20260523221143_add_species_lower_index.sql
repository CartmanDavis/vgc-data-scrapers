-- Functional index so LOWER(species) predicates can use an index scan.
-- Needed by get_pokemon_matchups, get_pokemon_partners, get_pokemon_moves,
-- get_pokemon_items, and get_pokemon_players (all use LOWER(ps.species) = LOWER(p_species)).
-- Without this index those queries do full table scans and exceed the 3s anon statement_timeout.
CREATE INDEX IF NOT EXISTS idx_pokemon_sets_species_lower ON pokemon_sets (LOWER(species));
