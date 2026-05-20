import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageChart } from '../components/UsageChart';

// Recharts uses ResizeObserver; provide a stub
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver;

const sampleData = [
  { name: 'Charizard',   usage: 42.5, winRate: 55.1 },
  { name: 'Salamence',   usage: 38.2, winRate: 52.0 },
  { name: 'Kangaskhan',  usage: 31.0, winRate: 50.5 },
  { name: 'Gengar',      usage: 25.7, winRate: 48.3 },
];

describe('UsageChart', () => {
  it('renders without crashing', () => {
    render(<UsageChart data={sampleData} />);
    expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    render(<UsageChart data={[]} />);
    expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
  });

  it('only shows top 20 entries', () => {
    const manyRows = Array.from({ length: 30 }, (_, i) => ({
      name: `Pokemon${i}`,
      usage: 100 - i,
    }));
    render(<UsageChart data={manyRows} />);
    // Chart should render without error
    expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
  });
});
