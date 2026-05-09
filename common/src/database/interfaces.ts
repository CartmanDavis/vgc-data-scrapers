export interface RawDataRow {
  id: string;
  details: string;
  standings: string;
  pairings: string;
}

export interface TournamentData {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  generation: number;
  format: string;
  official: boolean;
}

export interface PokemonSetData {
  teamId: number;
  species: string;
  item?: string | null;
  ability?: string | null;
  tera_type?: string | null;
  is_mega: boolean;
  invalid: boolean;
}

export interface MatchData {
  tournamentId: string;
  roundNumber: number;
  tableNumber?: number | null;
  phase?: number | null;
}

export interface MatchParticipantData {
  matchId: number;
  playerId: number;
  teamId: number;
  score: number;
}

export interface StandingData {
  tournamentId: string;
  playerId: number;
  teamId: number;
  placing?: number | null;
  wins: number;
  losses: number;
  ties: number;
  dropped: boolean;
}

export interface IDataStore {
  // Scraper: ensure a minimal tournament row exists before storing raw data (satisfies FK)
  ensureTournamentStub(id: string, name: string, date: string, format: string, generation: number): Promise<void>;
  rawDataExists(id: string): Promise<boolean>;
  storeRawData(id: string, details: unknown, standings: unknown, pairings: unknown): Promise<void>;

  // Processor: read raw data and check whether it's already been fully processed
  getRawData(tournamentIds?: string[]): Promise<RawDataRow[]>;
  isTournamentProcessed(id: string): Promise<boolean>;
  upsertTournament(t: TournamentData): Promise<void>;

  // Shared
  tournamentExists(id: string): Promise<boolean>;
  findOrCreatePlayer(name: string, country?: string): Promise<number>;
  findOrCreateTeam(playerId: number, tournamentId: string): Promise<number>;
  insertPokemonSet(data: PokemonSetData): Promise<number>;
  insertMove(pokemonSetId: number, moveName: string): Promise<void>;
  insertMatch(data: MatchData): Promise<number>;
  upsertMatchParticipant(data: MatchParticipantData): Promise<void>;
  upsertStanding(data: StandingData): Promise<void>;

  close(): void;
}
