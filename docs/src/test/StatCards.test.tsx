import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StatCards } from '../components/StatCards';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: '1', date: '2026-01-01' },
            { id: '2', date: '2026-03-15' },
          ],
          count: 2,
          error: null,
        }),
      })),
    })),
    rpc: vi.fn().mockResolvedValue({
      data: [{ unique_players: 120 }],
      error: null,
    }),
  },
}));

describe('StatCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton cards while loading', () => {
    render(<StatCards />);
    const skeletons = document.querySelectorAll('.stat-card--skeleton');
    expect(skeletons).toHaveLength(4);
  });

  it('renders four stat cards after loading', async () => {
    render(<StatCards />);
    await waitFor(() => {
      expect(screen.queryAllByClass?.('stat-card--skeleton')).toHaveLength(0);
    });
    await waitFor(() => {
      expect(screen.getByText('Tournaments')).toBeInTheDocument();
      expect(screen.getByText('Players')).toBeInTheDocument();
      expect(screen.getByText('Date Range')).toBeInTheDocument();
      expect(screen.getByText('Format')).toBeInTheDocument();
    });
  });

  it('displays tournament count', async () => {
    render(<StatCards />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('displays format label', async () => {
    render(<StatCards />);
    await waitFor(() => {
      expect(screen.getByText('M-A (Mega)')).toBeInTheDocument();
    });
  });

  it('has accessible label for the cards container', () => {
    render(<StatCards />);
    expect(screen.getByRole('region', { hidden: true })).toBeInTheDocument();
  });
});
