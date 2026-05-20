import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from '../components/NavBar';

function renderWithRouter(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NavBar />
    </MemoryRouter>
  );
}

describe('NavBar', () => {
  it('renders all three nav items', () => {
    renderWithRouter();
    expect(screen.getByText('Metagame')).toBeInTheDocument();
    expect(screen.getByText('Pokemon')).toBeInTheDocument();
    expect(screen.getByText('Mega')).toBeInTheDocument();
  });

  it('marks Metagame as active on root path', () => {
    renderWithRouter('/');
    const metagameLink = screen.getByRole('link', { name: /metagame/i });
    expect(metagameLink).toHaveClass('active');
  });

  it('marks Pokemon as active on /pokemon path', () => {
    renderWithRouter('/pokemon');
    const pokemonLink = screen.getByRole('link', { name: /pokemon/i });
    expect(pokemonLink).toHaveClass('active');
  });

  it('does not mark Metagame as active on /pokemon path', () => {
    renderWithRouter('/pokemon');
    const metagameLink = screen.getByRole('link', { name: /metagame/i });
    expect(metagameLink).not.toHaveClass('active');
  });

  it('has correct hrefs', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /metagame/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /pokemon/i })).toHaveAttribute('href', '/pokemon');
    expect(screen.getByRole('link', { name: /mega/i })).toHaveAttribute('href', '/mega');
  });
});
