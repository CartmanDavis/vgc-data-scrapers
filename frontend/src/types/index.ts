export interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string | null;
  generation: number;
  format: string;
  official: boolean;
}

export interface Player {
  id: number;
  name: string;
  country: string | null;
}

export interface Team {
  id: number;
  player_id: number;
  tournament_id: string;
}

export interface TeamWithPlayer extends Team {
  player_name: string;
}

export interface PokemonSet {
  id: number;
  team_id: number;
  species: string;
  form: string | null;
  item: string | null;
  ability: string | null;
  tera_type: string | null;
}

export interface Move {
  id: number;
  pokemon_set_id: number;
  move_name: string;
}

export interface PokemonWithMoves extends PokemonSet {
  moves: string[];
}

export interface TeamWithPokemon extends TeamWithPlayer {
  pokemon: PokemonWithMoves[];
}

export interface TournamentStanding {
  id: number;
  tournament_id: string;
  player_id: number;
  team_id: number;
  placing: number | null;
  wins: number;
  losses: number;
  ties: number;
  dropped: boolean;
}

export interface TournamentStandingWithPlayer extends TournamentStanding {
  player_name: string;
}

export interface Match {
  id: number;
  tournament_id: string;
  round_number: number;
  table_number: number | null;
  phase: number | null;
}

export interface MatchParticipant {
  id: number;
  match_id: number;
  player_id: number;
  team_id: number;
  score: number;
}

export interface UsageStat {
  species: string;
  count: number;
  percentage: number;
}

export interface UsageStatByFormat {
  format: string;
  stats: UsageStat[];
}

export interface TrendData {
  date: string;
  usage: number;
}

export interface PairStats {
  pokemon1: string;
  pokemon2: string;
  count: number;
  winRate: number;
}
