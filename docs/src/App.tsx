import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { NavBar, MobileNav } from './components/NavBar';
import { MetagamePage } from './pages/MetagamePage';
import { PokemonListPage } from './pages/PokemonListPage';
import { PokemonPage } from './pages/PokemonPage';
import { MegaListPage } from './pages/MegaListPage';
import { TeamsPage } from './pages/TeamsPage';
import { MegaPage } from './pages/MegaPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { PlayersPage } from './pages/PlayersPage';
import { PlayerPage } from './pages/PlayerPage';
import { DataProvenancePage } from './pages/DataProvenancePage';
import { DemoControls } from './DemoControls';
import 'bootstrap-icons/font/bootstrap-icons.css';

type DemoMode = 'loaded' | 'loading' | 'error';

// Write mode to window so the supabase mock can read it synchronously
function applyMode(m: DemoMode) {
  (window as unknown as { __DEMO_MODE__: DemoMode }).__DEMO_MODE__ = m;
}

// Start loaded
applyMode('loaded');

function App() {
  const [demoMode, setDemoMode] = useState<DemoMode>('loaded');
  // Incrementing this key forces the main content to fully unmount + remount,
  // causing all data hooks to re-fire against the new demo mode.
  const [fetchKey, setFetchKey] = useState(0);

  const handleDemoMode = useCallback((m: DemoMode) => {
    applyMode(m);
    setDemoMode(m);
    setFetchKey(k => k + 1);
  }, []);

  return (
    <div className="app-shell">
      <NavBar />
      <MobileNav />
      <div className="main-content" key={fetchKey}>
        <Routes>
          <Route path="/"                 element={<MetagamePage />} />
          <Route path="/pokemon"          element={<PokemonListPage />} />
          <Route path="/pokemon/:species" element={<PokemonPage />} />
          <Route path="/teams"             element={<TeamsPage />} />
          <Route path="/mega"             element={<MegaListPage />} />
          <Route path="/mega/:item"       element={<MegaPage />} />
          <Route path="/tournaments"      element={<TournamentsPage />} />
          <Route path="/tournaments/:id"  element={<TournamentDetailPage />} />
          <Route path="/players"          element={<PlayersPage />} />
          <Route path="/players/:id"      element={<PlayerPage />} />
          <Route path="/provenance"       element={<DataProvenancePage />} />
        </Routes>
      </div>
      <DemoControls mode={demoMode} onSet={handleDemoMode} />
    </div>
  );
}

export default App;
