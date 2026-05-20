import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import './UsageChart.css';

interface UsageRow {
  name: string;
  usage: number;
  winRate?: number;
}

interface Props {
  data: UsageRow[];
  nameKey?: string;
}

const ACCENT = '#c084fc';
const ACCENT_DIM = 'rgba(192,132,252,0.45)';

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__name">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="chart-tooltip__row">
          <span>{p.name === 'usage' ? 'Usage' : 'Win Rate'}</span>
          <span>{p.value.toFixed(1)}%</span>
        </p>
      ))}
    </div>
  );
}

export function UsageChart({ data, nameKey = 'name' }: Props) {
  const top20 = data.slice(0, 20);

  return (
    <div className="usage-chart" data-testid="usage-chart">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={top20}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            dataKey={nameKey}
            type="category"
            width={130}
            tick={{ fill: '#f1f5f9', fontSize: 13 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
          <Bar dataKey="usage" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {top20.map((_, idx) => (
              <Cell key={idx} fill={idx === 0 ? ACCENT : ACCENT_DIM} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
