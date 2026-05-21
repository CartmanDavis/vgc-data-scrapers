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

export type TrendMetric = "usage" | "winrate" | "both";

const USAGE_COLOR = "var(--accent)";
const WR_COLOR_BOTH = "var(--green)";

function wrSingleColor(val: number): string {
  if (val >= 55) return "var(--green)";
  if (val >= 50) return "var(--accent-2)";
  return "var(--red)";
}

interface Props {
  data: TrendPoint[];
  name?: string;
  showToggle?: boolean;
  defaultMetric?: TrendMetric;
  height?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  metric: TrendMetric;
}) {
  if (!active || !payload?.length) return null;
  const usageEntry = payload.find((p) => p.dataKey === "usage_pct");
  const wrEntry = payload.find((p) => p.dataKey === "win_rate");

  return (
    <div className="trend-tooltip">
      <p className="trend-tooltip__date">{label}</p>
      {usageEntry && (
        <div className="trend-tooltip__row">
          <span className="trend-tooltip__label">Usage</span>
          <span className="trend-tooltip__val" style={{ color: USAGE_COLOR }}>
            {usageEntry.value.toFixed(1)}%
          </span>
        </div>
      )}
      {wrEntry && (
        <div className="trend-tooltip__row">
          <span className="trend-tooltip__label">Win Rate</span>
          <span
            className="trend-tooltip__val"
            style={{
              color:
                metric === "both"
                  ? WR_COLOR_BOTH
                  : wrSingleColor(wrEntry.value),
            }}
          >
            {wrEntry.value.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function TrendChart({
  data,
  name,
  showToggle = true,
  defaultMetric = "usage",
  height = 220,
}: Props) {
  const [metric, setMetric] = useState<TrendMetric>(defaultMetric);

  const showUsage = metric === "usage" || metric === "both";
  const showWinRate = metric === "winrate" || metric === "both";

  const allVals = data.flatMap((d) => {
    const v: number[] = [];
    if (showUsage) v.push(d.usage_pct);
    if (showWinRate) v.push(d.win_rate);
    return v;
  });
  const minVal = allVals.length
    ? Math.max(0, Math.floor(Math.min(...allVals) - 4))
    : 0;
  const maxVal = allVals.length ? Math.ceil(Math.max(...allVals) + 4) : 100;

  const lastPoint = data[data.length - 1];
  const wrColor =
    metric === "both"
      ? WR_COLOR_BOTH
      : lastPoint
        ? wrSingleColor(lastPoint.win_rate)
        : "var(--text-3)";

  return (
    <div className="trend-chart">
      <div className="trend-chart__header">
        <div className="trend-chart__title">
          {name && <span className="trend-chart__name">{name}</span>}
          <span className="trend-chart__period">Jan – Apr 2026 · weekly</span>
        </div>
        <div className="trend-chart__right">
          {metric === "both" && (
            <div className="trend-legend">
              <span className="trend-legend__item">
                <span
                  className="trend-legend__dot"
                  style={{ background: USAGE_COLOR }}
                />
              </span>
              <span className="trend-legend__item">
                <span
                  className="trend-legend__dot"
                  style={{ background: WR_COLOR_BOTH }}
                />
              </span>
            </div>
          )}
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
              <button
                className={`trend-toggle-btn${metric === "both" ? " active" : ""}`}
                onClick={() => setMetric("both")}
              >
                Both
              </button>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 24, left: -8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="1 4"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          {showWinRate && (
            <ReferenceLine
              y={50}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />
          )}
          <XAxis
            dataKey="date"
            tick={{
              fill: "var(--text-4)",
              fontSize: 11,
              fontFamily: "JetBrains Mono, monospace",
            }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={1}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tickFormatter={(v) => `${v}%`}
            tick={{
              fill: "var(--text-4)",
              fontSize: 11,
              fontFamily: "JetBrains Mono, monospace",
            }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            content={<CustomTooltip metric={metric} />}
            cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
          />
          {showUsage && (
            <Line
              key={`usage-${metric}`}
              type="monotone"
              dataKey="usage_pct"
              stroke={USAGE_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: USAGE_COLOR,
                stroke: "var(--bg)",
                strokeWidth: 2,
              }}
              animationDuration={350}
            />
          )}
          {showWinRate && (
            <Line
              key={`wr-${metric}`}
              type="monotone"
              dataKey="win_rate"
              stroke={wrColor}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: wrColor,
                stroke: "var(--bg)",
                strokeWidth: 2,
              }}
              animationDuration={350}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
