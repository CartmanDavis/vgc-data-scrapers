import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { UsageChart } from '../components/UsageChart';
import { TrendChart } from '../components/TrendChart';
import { getUsageStats, getUsageTrend, getFormats } from '../lib/queries';
import type { UsageStat, TrendData } from '../types';

export function UsageStats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const formatFilter = searchParams.get('format') || 'SVF';
  const pokemonFilter = searchParams.get('pokemon') || '';
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [statsData, trendData, formatsData] = await Promise.all([
        getUsageStats(formatFilter, 50),
        pokemonFilter ? getUsageTrend(pokemonFilter) : Promise.resolve([]),
        getFormats(),
      ]);
      setStats(statsData);
      setTrend(trendData);
      setFormats(formatsData);
      setLoading(false);
    };
    loadData();
  }, [formatFilter, pokemonFilter]);
  
  const handleFormatChange = (format: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('format', format);
    setSearchParams(params);
  };
  
  const handlePokemonSelect = (species: string) => {
    const params = new URLSearchParams(searchParams);
    if (species) {
      params.set('pokemon', species);
    } else {
      params.delete('pokemon');
    }
    setSearchParams(params);
  };
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Usage Statistics</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Format:</label>
            <select
              value={formatFilter}
              onChange={(e) => handleFormatChange(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {formats.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="text-sm text-gray-600 block mb-2">View trend for Pokemon:</label>
          <select
            value={pokemonFilter}
            onChange={(e) => handlePokemonSelect(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full max-w-xs"
          >
            <option value="">Select a Pokemon...</option>
            {stats.map(stat => (
              <option key={stat.species} value={stat.species}>{stat.species}</option>
            ))}
          </select>
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <>
            {pokemonFilter && trend.length > 0 && (
              <TrendChart data={trend} pokemonName={pokemonFilter} />
            )}
            
            <UsageChart data={stats} title={`Top Pokemon - ${formatFilter}`} />
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Detailed Stats - {formatFilter}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pokemon</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usage %</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.map((stat, idx) => (
                      <tr key={stat.species} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-2 text-sm font-medium">{stat.species}</td>
                        <td className="px-4 py-2 text-sm">{stat.percentage}%</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{stat.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
