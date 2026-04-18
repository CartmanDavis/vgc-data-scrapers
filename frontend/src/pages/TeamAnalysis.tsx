import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { StatTable } from '../components/StatTable';
import { getTopPairs } from '../lib/queries';
import type { PairStats } from '../types';

export function TeamAnalysis() {
  const [pairs, setPairs] = useState<PairStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const pairsData = await getTopPairs(20);
      setPairs(pairsData);
      setLoading(false);
    };
    loadData();
  }, []);
  
  const columns = [
    { key: 'pokemon1', header: 'Pokemon 1' },
    { key: 'pokemon2', header: 'Pokemon 2' },
    { 
      key: 'count', 
      header: 'Count',
      render: (row: PairStats) => row.count,
    },
    { 
      key: 'winRate', 
      header: 'Win Rate',
      render: (row: PairStats) => row.winRate > 0 ? `${row.winRate.toFixed(1)}%` : '-',
    },
  ];
  
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Analysis</h1>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Top Pokemon Pairs</h2>
              <p className="text-sm text-gray-600 mb-4">
                Most commonly used Pokemon pairs in teams
              </p>
              <StatTable data={pairs} columns={columns} />
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Coming Soon</h2>
              <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li>Team cluster analysis</li>
                <li>Counter prediction</li>
                <li>Top performing team compositions</li>
                <li>Regional usage differences</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
