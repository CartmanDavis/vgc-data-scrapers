import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TeamCard } from '../TeamCard';
import type { TeamWithPokemon } from '../../types';

describe('TeamCard', () => {
  const mockTeam: TeamWithPokemon = {
    id: 1,
    player_id: 1,
    tournament_id: 'tournament-1',
    player_name: 'Test Player',
    pokemon: [
      {
        id: 1,
        team_id: 1,
        species: 'Charizard',
        form: null,
        item: 'Choice Specs',
        ability: 'Blaze',
        tera_type: 'Fire',
        moves: ['Flamethrower', 'Dragon Claw'],
      },
      {
        id: 2,
        team_id: 1,
        species: 'Blastoise',
        form: null,
        item: 'Leftovers',
        ability: 'Torrent',
        tera_type: 'Water',
        moves: ['Hydro Pump', 'Ice Beam'],
      },
    ],
  };
  
  it('renders player name when showPlayer is true', () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} showPlayer />
      </BrowserRouter>
    );
    expect(screen.getByText('Test Player')).toBeInTheDocument();
  });
  
  it('renders pokemon in the team', () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} />
      </BrowserRouter>
    );
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText('Blastoise')).toBeInTheDocument();
  });
  
  it('does not render player name when showPlayer is false', () => {
    render(
      <BrowserRouter>
        <TeamCard team={mockTeam} showPlayer={false} />
      </BrowserRouter>
    );
    expect(screen.queryByText('Test Player')).not.toBeInTheDocument();
  });
  
  it('renders empty team correctly', () => {
    const emptyTeam: TeamWithPokemon = {
      id: 1,
      player_id: 1,
      tournament_id: 'tournament-1',
      player_name: 'Test Player',
      pokemon: [],
    };
    
    render(
      <BrowserRouter>
        <TeamCard team={emptyTeam} />
      </BrowserRouter>
    );
    expect(screen.getByText('Test Player')).toBeInTheDocument();
  });
});
