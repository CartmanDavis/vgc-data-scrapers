import type { PokemonWithMoves } from '../types';

function normalizePokemonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/[^a-z0-9-]/g, '');
}

interface PokemonCardProps {
  pokemon: PokemonWithMoves;
  compact?: boolean;
}

export function PokemonCard({ pokemon, compact = false }: PokemonCardProps) {
  const normalizedName = normalizePokemonName(pokemon.species);
  const spriteUrl = `https://img.pokemondb.net/sprites/scarlet-violet/normal/${normalizedName}.png`;
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
        <img 
          src={spriteUrl} 
          alt={pokemon.species}
          className="w-12 h-12"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://img.pokemondb.net/sprites/scarlet-violet/normal/0.png';
          }}
        />
        <div>
          <div className="font-medium text-sm">{pokemon.species}</div>
          {pokemon.item && <div className="text-xs text-gray-500">{pokemon.item}</div>}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <img 
          src={spriteUrl} 
          alt={pokemon.species}
          className="w-24 h-24"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://img.pokemondb.net/sprites/scarlet-violet/normal/0.png';
          }}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">{pokemon.species}</h3>
            {pokemon.tera_type && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                Tera: {pokemon.tera_type}
              </span>
            )}
            {pokemon.form && (
              <span className="text-gray-500 text-sm">({pokemon.form})</span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            {pokemon.item && (
              <div>
                <span className="text-gray-500">Item:</span>{' '}
                <span className="font-medium">{pokemon.item}</span>
              </div>
            )}
            {pokemon.ability && (
              <div>
                <span className="text-gray-500">Ability:</span>{' '}
                <span className="font-medium">{pokemon.ability}</span>
              </div>
            )}
          </div>
          
          {pokemon.moves.length > 0 && (
            <div className="mt-2">
              <span className="text-gray-500 text-sm">Moves:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {pokemon.moves.map(move => (
                  <span 
                    key={move}
                    className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {move}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
