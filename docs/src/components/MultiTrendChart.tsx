import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TrendPoint } from "../mock-data";
import "./TrendChart.css";
import "./MultiTrendChart.css";

export type MultiTrendMetric = "usage" | "winrate";

export interface TrendSeries {
  name: string;
  color: string;
  points: TrendPoint[];
}

interface Props {
  series: TrendSeries[];
  defaultMetric?: MultiTrendMetric;
  height?: number;
  showToggle?: boolean;
}

function CustomTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  series: TrendSeries[];
}) {
  if (!active || !payload?.length) return null;
  const colorMap = Object.fromEntries(series.map((s) => [s.name, s.color]));
  return (
    <div className="trend-tooltip">
      <p className="trend-tooltip__date">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="trend-tooltip__row">
          <span className="trend-tooltip__label" style={{ color: colorMap[entry.dataKey] }}>
            {entry.dataKey}
          </span>
          <span className="trend-tooltip__val" style={{ color: colorMap[entry.dataKey] }}>
            {entry.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function MultiTrendChart({ series, defaultMetric = "usage", height = 200, showToggle = true }: Props) {
  const [metric, setMetric] = useState<MultiTrendMetric>(defaultMetric);

  const dataKey = metric === "usage" ? "usage_pct" : "win_rate";

  // Merge all series into one flat data array keyed by series name
  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const mergedData = dates.map((date, i) => {
    const row: Record<string, number | string> = { date };
    for (const s of series) {
      row[s.name] = s.points[i]?.[dataKey] ?? 0;
    }
    return row;
  });

  const allVals = series.flatMap((s) => s.points.map((p) => p[dataKey]));
  const minVal = allVals.length ? Math.max(0, Math.floor(Math.min(...allVals) - 4)) : 0;
  const maxVal = allVals.length ? Math.ceil(Math.max(...allVals) + 4) : 100;

  return (
    <div className="trend-chart">
      <div className="trend-chart__header">
        <div className="multi-trend__legend">
          {series.map((s) => (
            <span key={s.name} className="multi-trend__legend-item">
              <span className="multi-trend__legend-dot" style={{ background: s.color }} />
              <span className="multi-trend__legend-name">{s.name}</span>
            </span>
          ))}
        </div>
        {showToggle && (
          <div className="trend-chart__toggle">
            <button
              className={`trend-toggle-btn${metric === "usage" ? " active" : ""}`}
              onClick={() => setMetric("usage")}
            >
              Usage %
            </button>
            <button
              className={`trend-toggle-btn${metric === "winrate" ? " active" : ""}`}
              onClick={() => setMetric("winrate")}
            >
              Win Rate
            </button>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={mergedData} margin={{ top: 8, right: 24, left: -8, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="1 4"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          {metric === "winrate" && (
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          )}
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-4)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={1}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "var(--text-4)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            content={<CustomTooltip series={series} />}
            cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
          />
          {series.map((s) => (
            <Line
              key={`${s.name}-${metric}`}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: s.color, stroke: "var(--bg)", strokeWidth: 2 }}
              animationDuration={250}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
