import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PokemonCard } from '../PokemonCard';
import type { PokemonWithMoves } from '../../types';

describe('PokemonCard', () => {
  const mockPokemon: PokemonWithMoves = {
    id: 1,
    team_id: 1,
    species: 'Charizard',
    form: null,
    item: 'Choice Specs',
    ability: 'Blaze',
    tera_type: 'Fire',
    moves: ['Flamethrower', 'Dragon Claw', 'Air Slash', 'Roost'],
  };
  
  it('renders pokemon species name', () => {
    render(<PokemonCard pokemon={mockPokemon} />);
    expect(screen.getByText('Charizard')).toBeInTheDocument();
  });
  
  it('renders item when provided', () => {
    render(<PokemonCard pokemon={mockPokemon} />);
    expect(screen.getByText('Choice Specs')).toBeInTheDocument();
  });
  
  it('renders ability when provided', () => {
    render(<PokemonCard pokemon={mockPokemon} />);
    expect(screen.getByText('Blaze')).toBeInTheDocument();
  });
  
  it('renders tera type when provided', () => {
    render(<PokemonCard pokemon={mockPokemon} />);
    expect(screen.getByText('Tera: Fire')).toBeInTheDocument();
  });
  
  it('renders moves when provided', () => {
    render(<PokemonCard pokemon={mockPokemon} />);
    expect(screen.getByText('Flamethrower')).toBeInTheDocument();
    expect(screen.getByText('Dragon Claw')).toBeInTheDocument();
  });
  
  it('renders compact version correctly', () => {
    render(<PokemonCard pokemon={mockPokemon} compact />);
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText('Choice Specs')).toBeInTheDocument();
  });
  
  it('handles missing optional fields', () => {
    const minimalPokemon: PokemonWithMoves = {
      id: 1,
      team_id: 1,
      species: 'Pikachu',
      form: null,
      item: null,
      ability: null,
      tera_type: null,
      moves: [],
    };
    
    render(<PokemonCard pokemon={minimalPokemon} />);
    expect(screen.getByText('Pikachu')).toBeInTheDocument();
  });
});
