import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatTable } from '../components/StatTable';
import { getTournamentsByFormat, getFormats, getTournamentCountByFormat } from '../lib/queries';
import type { Tournament } from '../types';

const PAGE_SIZE = 50;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
}

export function TournamentList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const formatFilter = searchParams.get('format') || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const offset = (page - 1) * PAGE_SIZE;
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const formatParam = formatFilter === 'all' ? null : formatFilter;
      const [tournamentData, formatData, countData] = await Promise.all([
        getTournamentsByFormat(formatParam, PAGE_SIZE, offset),
        getFormats(),
        getTournamentCountByFormat(formatParam),
      ]);
      setTournaments(tournamentData);
      setFormats(formatData);
      setTotalCount(countData);
      setLoading(false);
    };
    loadData();
  }, [formatFilter, page]);
  
  const handleFormatChange = (format: string) => {
    setSearchParams({ format, page: '1' });
  };
  
  const handlePageChange = (newPage: number) => {
    setSearchParams({ format: formatFilter, page: String(newPage) });
  };
  
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages;
  
  const columns = [
    {
      key: 'name',
      header: 'Tournament',
      render: (row: Tournament) => (
        <Link 
          to={`/tournament/${row.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row: Tournament) => formatDate(row.date),
    },
    { key: 'location', header: 'Location' },
    { key: 'format', header: 'Format' },
    {
      key: 'official',
      header: 'Official',
      render: (row: Tournament) => row.official ? '✓' : '-',
    },
  ];
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Format:</label>
            <select
              value={formatFilter}
              onChange={(e) => handleFormatChange(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="all">All Formats</option>
              {formats.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tournaments found
          </div>
        ) : (
          <>
            <StatTable data={tournaments} columns={columns} />
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {offset + 1} - {Math.min(offset + tournaments.length, totalCount)} of {totalCount}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasNext}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
