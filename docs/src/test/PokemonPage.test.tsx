import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PokemonPage } from '../pages/PokemonPage';

function renderPage(species?: string) {
  const path = species ? `/pokemon/${species}` : '/pokemon/';
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/pokemon/:species" element={<PokemonPage />} />
        <Route path="/pokemon/" element={<PokemonPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PokemonPage', () => {
  it('renders the species name as heading', () => {
    renderPage('Charizard');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Charizard');
  });

  it('renders a back link to the metagame', () => {
    renderPage('Charizard');
    const back = screen.getByRole('link', { name: /back to metagame/i });
    expect(back).toHaveAttribute('href', '/');
  });

  it('shows species name in placeholder text', () => {
    renderPage('Salamence');
    expect(screen.getByText(/salamence/i)).toBeInTheDocument();
  });
});
