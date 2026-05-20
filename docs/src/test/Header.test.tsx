import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';

describe('Header', () => {
  it('renders the site title', () => {
    render(<Header />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Limitless VGC Usage Stats');
  });

  it('does not mention SQLite', () => {
    render(<Header />);
    expect(document.body.textContent).not.toMatch(/sqlite/i);
  });

  it('mentions Supabase', () => {
    render(<Header />);
    expect(document.body.textContent).toMatch(/supabase/i);
  });

  it('links to Limitless TCG', () => {
    render(<Header />);
    const link = screen.getByRole('link', { name: /limitless api/i });
    expect(link).toHaveAttribute('href', 'https://play.limitlesstcg.com/');
  });
});
