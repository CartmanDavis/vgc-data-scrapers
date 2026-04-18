import { Link } from 'react-router-dom';
import type { TeamWithPokemon } from '../types';
import { PokemonCard } from './PokemonCard';

interface TeamCardProps {
  team: TeamWithPokemon;
  showPlayer?: boolean;
}

export function TeamCard({ team, showPlayer = true }: TeamCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {showPlayer && (
        <div className="mb-3">
          <Link 
            to={`/player/${team.player_id}`}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            {team.player_name}
          </Link>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {team.pokemon.map(pokemon => (
          <PokemonCard key={pokemon.id} pokemon={pokemon} compact />
        ))}
      </div>
    </div>
  );
}
