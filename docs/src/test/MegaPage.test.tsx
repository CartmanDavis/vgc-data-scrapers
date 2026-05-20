import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MegaPage } from '../pages/MegaPage';

function renderPage(item?: string) {
  const path = item ? `/mega/${item}` : '/mega/';
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mega/:item" element={<MegaPage />} />
        <Route path="/mega/" element={<MegaPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MegaPage', () => {
  it('renders the item name as heading', () => {
    renderPage('Charizardite X');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Charizardite X');
  });

  it('renders a back link to the metagame', () => {
    renderPage('Salamencite');
    const back = screen.getByRole('link', { name: /back to metagame/i });
    expect(back).toHaveAttribute('href', '/');
  });

  it('shows item name in placeholder text', () => {
    renderPage('Kangaskhanite');
    expect(screen.getByText(/kangaskhanite/i)).toBeInTheDocument();
  });
});
