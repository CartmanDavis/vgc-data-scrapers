import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatTable } from '../components/StatTable';
import { getPlayerById, getPlayerTournaments, getPlayerTeams } from '../lib/queries';
import type { Player, TournamentStandingWithPlayer, PokemonWithMoves } from '../types';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
}

interface TournamentWithTeam extends TournamentStandingWithPlayer {
  tournament_name?: string;
  date?: string;
  team_pokemon?: PokemonWithMoves[];
}

function normalizePokemonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/[^a-z0-9-]/g, '');
}

function PokemonIcon({ species }: { species: string }) {
  const normalizedName = normalizePokemonName(species);
  const spriteUrl = `https://img.pokemondb.net/sprites/scarlet-violet/normal/${normalizedName}.png`;
  return (
    <img 
      src={spriteUrl} 
      alt={species}
      className="w-8 h-8 inline-block"
      title={species}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'https://img.pokemondb.net/sprites/scarlet-violet/normal/0.png';
      }}
    />
  );
}

export function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [tournaments, setTournaments] = useState<TournamentStandingWithPlayer[]>([]);
  const [teams, setTeams] = useState<Map<number, PokemonWithMoves[]>>(new Map());
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!id) return;
    
    const loadData = async () => {
      setLoading(true);
      const playerId = parseInt(id, 10);
      const [playerData, tournamentsData, teamsData] = await Promise.all([
        getPlayerById(playerId),
        getPlayerTournaments(playerId),
        getPlayerTeams(playerId),
      ]);
      setPlayer(playerData);
      
      const teamsMap = new Map<number, PokemonWithMoves[]>();
      teamsData.forEach(team => {
        teamsMap.set(team.id, team.pokemon);
      });
      setTeams(teamsMap);
      
      setTournaments(tournamentsData);
      setLoading(false);
    };
    loadData();
  }, [id]);
  
  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8 text-gray-500">Loading...</div>
      </Layout>
    );
  }
  
  if (!player) {
    return (
      <Layout>
        <div className="text-center py-8 text-gray-500">Player not found</div>
      </Layout>
    );
  }
  
  const tournamentsWithTeams: TournamentWithTeam[] = tournaments.map(t => ({
    ...t,
    team_pokemon: t.team_id ? teams.get(t.team_id) : undefined,
  }));
  
  const tournamentColumns = [
    {
      key: 'tournament_name',
      header: 'Tournament',
      render: (row: TournamentWithTeam) => (
        <Link 
          to={`/tournament/${row.tournament_id}`}
          className="text-blue-600 hover:text-blue-800"
        >
          {row.tournament_name || row.tournament_id}
        </Link>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      render: (row: TournamentWithTeam) => {
        if (!row.team_pokemon || row.team_pokemon.length === 0) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <span title={row.team_pokemon.map(p => p.species).join(', ')}>
            {row.team_pokemon.slice(0, 6).map(p => (
              <PokemonIcon key={p.id} species={p.species} />
            ))}
          </span>
        );
      },
    },
    { 
      key: 'date', 
      header: 'Date',
      render: (row: TournamentWithTeam) => row.date ? formatDate(row.date) : '-',
    },
    { key: 'format', header: 'Format' },
    { key: 'placing', header: 'Place' },
    { key: 'wins', header: 'W' },
    { key: 'losses', header: 'L' },
  ];
  
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Tournaments
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{player.name}</h1>
          {player.country && (
            <div className="text-gray-600 mt-1">Country: {player.country}</div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{tournaments.length}</div>
            <div className="text-sm text-gray-500">Tournaments</div>
          </div>
        </div>
        
        <StatTable data={tournamentsWithTeams} columns={tournamentColumns} />
      </div>
    </Layout>
  );
}
