import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PokemonPage } from '../pages/PokemonPage';

// Recharts stub
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver;

const mockMoves    = [{ move_name: 'Earthquake',  teams: 80, win_rate: 55.5 }];
const mockItems    = [{ item: 'Life Orb',          teams: 60, win_rate: 53.0 }];
const mockPartners = [{ partner_species: 'Gengar', teams: 45, usage_pct: 56.2, win_rate: 52.1 }];
const mockMatchups = [{ opponent_species: 'Kyogre', matches: 30, wins: 18, win_rate: 60.0 }];

vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn((fn: string) => {
      const responses: Record<string, unknown[]> = {
        get_pokemon_usage:    [{ species: 'Garchomp', usage_pct: 42.5, win_rate: 54.2, teams: 120 }],
        get_pokemon_moves:    mockMoves,
        get_pokemon_items:    mockItems,
        get_pokemon_partners: mockPartners,
        get_pokemon_matchups: mockMatchups,
      };
      return Promise.resolve({ data: responses[fn] ?? [], error: null });
    }),
  },
}));

function renderPage(species: string) {
  return render(
    <MemoryRouter initialEntries={[`/pokemon/${species}`]}>
      <Routes>
        <Route path="/pokemon/:species" element={<PokemonPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PokemonPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders species heading', async () => {
    renderPage('Garchomp');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Garchomp');
    });
  });

  it('renders back link to metagame', async () => {
    renderPage('Garchomp');
    const back = screen.getByRole('link', { name: /back to metagame/i });
    expect(back).toHaveAttribute('href', '/');
  });

  it('shows stat badges after loading', async () => {
    renderPage('Garchomp');
    await waitFor(() => {
      expect(screen.getByText('42.5%')).toBeInTheDocument(); // usage
      expect(screen.getByText('54.2%')).toBeInTheDocument(); // win rate
    });
  });

  it('shows moves tab by default', async () => {
    renderPage('Garchomp');
    await waitFor(() => {
      expect(screen.getByText('Earthquake')).toBeInTheDocument();
    });
  });

  it('switches to items tab', async () => {
    renderPage('Garchomp');
    await waitFor(() => screen.getByText('Earthquake'));
    fireEvent.click(screen.getByRole('button', { name: /items/i }));
    await waitFor(() => {
      expect(screen.getByText('Life Orb')).toBeInTheDocument();
    });
  });

  it('switches to partners tab', async () => {
    renderPage('Garchomp');
    await waitFor(() => screen.getByText('Earthquake'));
    fireEvent.click(screen.getByRole('button', { name: /partners/i }));
    await waitFor(() => {
      expect(screen.getByText('Gengar')).toBeInTheDocument();
    });
  });

  it('switches to matchups tab', async () => {
    renderPage('Garchomp');
    await waitFor(() => screen.getByText('Earthquake'));
    fireEvent.click(screen.getByRole('button', { name: /matchups/i }));
    await waitFor(() => {
      expect(screen.getByText('Kyogre')).toBeInTheDocument();
    });
  });

  it('partner links navigate to pokemon profile', async () => {
    renderPage('Garchomp');
    await waitFor(() => screen.getByText('Earthquake'));
    fireEvent.click(screen.getByRole('button', { name: /partners/i }));
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Gengar' });
      expect(link).toHaveAttribute('href', '/pokemon/Gengar');
    });
  });

  it('shows empty state when no species param', () => {
    render(
      <MemoryRouter initialEntries={['/pokemon/']}>
        <Routes>
          <Route path="/pokemon/" element={<PokemonPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/no pokemon selected/i)).toBeInTheDocument();
  });
});
