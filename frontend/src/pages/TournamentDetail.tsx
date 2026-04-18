import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatTable } from '../components/StatTable';
import { TeamCard } from '../components/TeamCard';
import { getTournamentById, getStandingsByTournament, getTeamsByTournament } from '../lib/queries';
import type { Tournament, TournamentStandingWithPlayer, TeamWithPlayer } from '../types';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<TournamentStandingWithPlayer[]>([]);
  const [teams, setTeams] = useState<TeamWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'standings' | 'teams'>('standings');
  
  useEffect(() => {
    if (!id) return;
    
    const loadData = async () => {
      setLoading(true);
      const [tournamentData, standingsData, teamsData] = await Promise.all([
        getTournamentById(id),
        getStandingsByTournament(id),
        getTeamsByTournament(id),
      ]);
      setTournament(tournamentData);
      setStandings(standingsData);
      setTeams(teamsData);
      setLoading(false);
    };
    loadData();
  }, [id]);
  
  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8 text-gray-500">Loading...</div>
      </Layout>
    );
  }
  
  if (!tournament) {
    return (
      <Layout>
        <div className="text-center py-8 text-gray-500">Tournament not found</div>
      </Layout>
    );
  }
  
  const standingsColumns = [
    { key: 'placing', header: 'Place' },
    {
      key: 'player_name',
      header: 'Player',
      render: (row: TournamentStandingWithPlayer) => (
        <Link 
          to={`/player/${row.player_id}`}
          className="text-blue-600 hover:text-blue-800"
        >
          {row.player_name}
          {row.dropped && <span className="text-gray-400 italic text-sm ml-1">(dropped)</span>}
        </Link>
      ),
    },
    { key: 'wins', header: 'Wins' },
    { key: 'losses', header: 'Losses' },
  ];
  
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Tournaments
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{tournament.name}</h1>
          <div className="text-gray-600 mt-1">
            {formatDate(tournament.date)} • {tournament.location || 'Unknown location'} • {tournament.format}
          </div>
        </div>
        
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('standings')}
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'standings'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Standings ({standings.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'teams'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Teams ({teams.length})
          </button>
        </div>
        
        {activeTab === 'standings' && (
          <StatTable data={standings} columns={standingsColumns} />
        )}
        
        {activeTab === 'teams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map(team => (
              <TeamCard key={team.id} team={{ ...team, pokemon: [] }} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
