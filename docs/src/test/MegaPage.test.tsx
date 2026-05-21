import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MegaPage } from '../pages/MegaPage';

vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn((fn: string) => {
      const responses: Record<string, unknown[]> = {
        get_mega_usage: [
          { pokemon: 'Charizardite X', teams: 88, usage_pct: 45.0, win_rate: 54.5 },
        ],
        get_mega_teammates: [
          { species: 'Garchomp', teams: 60, usage_pct: 68.2, win_rate_with: 56.1, win_rate_without: 48.3 },
        ],
        get_mega_h2h: [
          { mega1: 'Charizardite X', mega2: 'Salamencite', matches: 25, mega1_wins: 14, mega2_wins: 11, mega1_wr: 56.0 },
          { mega1: 'Kangaskhanite', mega2: 'Charizardite X', matches: 20, mega1_wins: 9, mega2_wins: 11, mega1_wr: 45.0 },
        ],
      };
      return Promise.resolve({ data: responses[fn] ?? [], error: null });
    }),
  },
}));

function renderPage(item: string) {
  return render(
    <MemoryRouter initialEntries={[`/mega/${item}`]}>
      <Routes>
        <Route path="/mega/:item" element={<MegaPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MegaPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders item name as heading', async () => {
    renderPage('Charizardite X');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Charizardite X');
    });
  });

  it('renders back link to mega list', async () => {
    renderPage('Charizardite X');
    const back = await screen.findByRole('link', { name: /all mega items/i });
    expect(back).toHaveAttribute('href', '/mega');
  });

  it('shows stat badges after loading', async () => {
    renderPage('Charizardite X');
    await waitFor(() => {
      expect(screen.getByText('45.0%')).toBeInTheDocument(); // usage
      expect(screen.getByText('54.5%')).toBeInTheDocument(); // win rate
    });
  });

  it('shows teammates tab by default', async () => {
    renderPage('Charizardite X');
    await waitFor(() => {
      expect(screen.getByText('Garchomp')).toBeInTheDocument();
    });
  });

  it('teammates link to Pokemon profiles', async () => {
    renderPage('Charizardite X');
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Garchomp' });
      expect(link).toHaveAttribute('href', '/pokemon/Garchomp');
    });
  });

  it('switches to H2H tab', async () => {
    renderPage('Charizardite X');
    await waitFor(() => screen.getByText('Teammates'));
    fireEvent.click(screen.getByRole('button', { name: /head-to-head/i }));
    await waitFor(() => {
      expect(screen.getByText('Salamencite')).toBeInTheDocument();
    });
  });

  it('normalises H2H so queried item win rate is shown correctly', async () => {
    renderPage('Charizardite X');
    await waitFor(() => screen.getByText('Teammates'));
    fireEvent.click(screen.getByRole('button', { name: /head-to-head/i }));
    await waitFor(() => {
      // Kangaskhanite vs Charizardite X: original mega1_wr = 45.0 (Kangaskhan's WR)
      // After normalization, Charizardite X WR = 100 - 45 = 55.0%
      expect(screen.getByText('55.0%')).toBeInTheDocument();
    });
  });

  it('H2H opponents link to mega profiles', async () => {
    renderPage('Charizardite X');
    await waitFor(() => screen.getByText('Teammates'));
    fireEvent.click(screen.getByRole('button', { name: /head-to-head/i }));
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Salamencite' });
      expect(link).toHaveAttribute('href', '/mega/Salamencite');
    });
  });

  it('shows empty state when no item param', () => {
    render(
      <MemoryRouter initialEntries={['/mega/']}>
        <Routes>
          <Route path="/mega/" element={<MegaPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/no mega item selected/i)).toBeInTheDocument();
  });
});
