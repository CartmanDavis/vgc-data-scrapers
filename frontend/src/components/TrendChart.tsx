import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TrendData } from '../types';

interface TrendChartProps {
  data: TrendData[];
  title?: string;
  pokemonName?: string;
}

export function TrendChart({ data, title, pokemonName }: TrendChartProps) {
  const chartData = data.map(d => ({
    date: d.date,
    usage: Number(d.usage.toFixed(2)),
  }));
  
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      {pokemonName && <p className="text-sm text-gray-600 mb-4">Usage trend for {pokemonName}</p>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => value.split('-').slice(1).join('/')}
          />
          <YAxis unit="%" tick={{ fontSize: 12 }} />
          <Tooltip 
            formatter={(value: number) => [`${value}%`, 'Usage']}
            labelFormatter={(label) => label}
          />
          <Line 
            type="monotone" 
            dataKey="usage" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={{ fill: '#3B82F6', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
