import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import './UsageChart.css';

interface UsageRow {
  name:     string;
  usage:    number;
  winRate?: number;
}

interface Props {
  data:     UsageRow[];
  nameKey?: string;
}

function barFill(winRate?: number): string {
  if (winRate == null) return 'rgba(124,111,247,0.55)';
  if (winRate >= 55)   return 'rgba(34,211,160,0.65)';
  if (winRate >= 50)   return 'rgba(124,111,247,0.65)';
  return 'rgba(242,102,120,0.65)';
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: { value: number; name: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  const usage   = payload.find(p => p.name === 'usage');
  const winRate = payload.find(p => p.name === 'winRate');
  const wr      = winRate?.value;
  const wrColor = wr == null ? 'var(--text-2)' : wr >= 55 ? 'var(--green)' : wr >= 50 ? 'var(--accent-2)' : 'var(--red)';
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {usage && (
        <div className="chart-tooltip__row">
          <span>Usage</span>
          <span className="chart-tooltip__num">{usage.value.toFixed(1)}%</span>
        </div>
      )}
      {winRate && (
        <div className="chart-tooltip__row">
          <span>Win Rate</span>
          <span className="chart-tooltip__num" style={{ color: wrColor }}>{winRate.value.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

export function UsageChart({ data, nameKey = 'name' }: Props) {
  const items = data.slice(0, 20);
  const chartH = Math.max(340, items.length * 38 + 40);

  return (
    <div className="usage-chart" data-testid="usage-chart">
      <div className="chart-legend">
        <span className="chart-legend__item --green"><span />≥ 55% WR</span>
        <span className="chart-legend__item --purple"><span />50–55%</span>
        <span className="chart-legend__item --red"><span />&lt; 50%</span>
      </div>
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={items} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" horizontal={false} />
          <ReferenceLine x={50} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fill: 'var(--text-4)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            dataKey={nameKey}
            type="category"
            width={148}
            tick={{ fill: 'var(--text)', fontSize: 13, fontWeight: 500, fontFamily: 'Figtree, system-ui, sans-serif' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Bar dataKey="usage" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {items.map((row, i) => (
              <Cell key={i} fill={barFill(row.winRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
