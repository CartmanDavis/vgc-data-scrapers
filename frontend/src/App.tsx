import { createBrowserRouter, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppProvider } from './AppProvider';

const TournamentList = lazy(() => import('./pages/TournamentList').then(m => ({ default: m.TournamentList })));
const TournamentDetail = lazy(() => import('./pages/TournamentDetail').then(m => ({ default: m.TournamentDetail })));
const UsageStats = lazy(() => import('./pages/UsageStats').then(m => ({ default: m.UsageStats })));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile').then(m => ({ default: m.PlayerProfile })));
const TeamAnalysis = lazy(() => import('./pages/TeamAnalysis').then(m => ({ default: m.TeamAnalysis })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function AppLayout() {
  return (
    <AppProvider>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </AppProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <TournamentList />,
      },
      {
        path: 'tournament/:id',
        element: <TournamentDetail />,
      },
      {
        path: 'stats',
        element: <UsageStats />,
      },
      {
        path: 'player/:id',
        element: <PlayerProfile />,
      },
      {
        path: 'analysis',
        element: <TeamAnalysis />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
], {
  basename: '/',
});
