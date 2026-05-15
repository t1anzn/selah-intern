import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyMetric } from "../types";

interface EngagementViewProps {
  metrics: DailyMetric[];
  loading: boolean;
  error: string | null;
}

type RangeKey = "7d" | "30d" | "all";

type SeriesPoint = {
  date: string;
  label: string;
  reads: number;
  replies: number;
  totalUsers: number;
  activeUsers: number;
  combined?: number;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: SeriesPoint }>;
  label?: string;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const trendNumberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

function toUtcDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function shiftUtcDay(value: Date, offset: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + offset);
  return next;
}

function formatCount(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : trendNumberFormatter.format(value);
}

function formatPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function EngagementTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;

  return (
    <div className="engagement-tooltip">
      <div className="engagement-tooltip__label">{label}</div>
      <div className="engagement-tooltip__value">
        {formatCount(point.reads)} reads, {formatCount(point.replies)} replies —{" "}
        {formatCount((point.reads || 0) + (point.replies || 0))} combined
      </div>
      <div className="engagement-tooltip__meta">
        {point.activeUsers} active / {point.totalUsers} total users
      </div>
    </div>
  );
}

function buildDailySeries(metrics: DailyMetric[]): SeriesPoint[] {
  if (metrics.length === 0) return [];

  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const start = toUtcDay(sorted[0].date);
  const end = toUtcDay(sorted[sorted.length - 1].date);
  const byDate = new Map(
    sorted.map((metric) => [metric.date.slice(0, 10), metric]),
  );

  const points: SeriesPoint[] = [];
  for (let cursor = start; cursor <= end; cursor = shiftUtcDay(cursor, 1)) {
    const key = cursor.toISOString().slice(0, 10);
    const metric = byDate.get(key);
    points.push({
      date: key,
      label: shortDateFormatter.format(cursor),
      reads: metric?.chaptersRead ?? 0,
      replies: metric?.notesCreated ?? 0,
      activeUsers: metric?.activeUsers ?? 0,
      totalUsers: metric?.totalUsers ?? 0,
    });
  }

  return points;
}

function buildAllTimeSeries(series: SeriesPoint[]): SeriesPoint[] {
  if (series.length === 0) return [];

  const buckets: SeriesPoint[] = [];
  for (let index = 0; index < series.length; index += 7) {
    const bucket = series.slice(index, index + 7);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    buckets.push({
      date: first.date,
      label:
        bucket.length > 1
          ? `${shortDateFormatter.format(toUtcDay(first.date))}–${shortDateFormatter.format(toUtcDay(last.date))}`
          : shortDateFormatter.format(toUtcDay(first.date)),
      reads: average(bucket.map((point) => point.reads)),
      replies: average(bucket.map((point) => point.replies)),
      activeUsers: average(bucket.map((point) => point.activeUsers)),
      totalUsers: average(bucket.map((point) => point.totalUsers)),
    });
  }

  return buckets;
}

function getWindowSeries(series: SeriesPoint[], range: RangeKey) {
  if (range === "all") {
    const allTimeSeries = buildAllTimeSeries(series);
    const splitIndex = Math.max(1, Math.floor(allTimeSeries.length / 2));

    return {
      chartSeries: allTimeSeries,
      comparisonSeries: allTimeSeries.slice(0, splitIndex),
      comparisonLabel: "first half",
      granularityLabel: "Weekly average",
    };
  }

  const windowSize = range === "7d" ? 7 : 30;
  const chartSeries = series.slice(-windowSize);
  const comparisonSeries = series.slice(
    Math.max(0, series.length - windowSize * 2),
    Math.max(0, series.length - windowSize),
  );

  return {
    chartSeries,
    comparisonSeries,
    comparisonLabel: `previous ${windowSize} days`,
    granularityLabel: "Daily",
  };
}

export function EngagementView({
  metrics,
  loading,
  error,
}: EngagementViewProps) {
  const [range, setRange] = useState<RangeKey>("7d");

  const dailySeries = buildDailySeries(metrics);
  const { chartSeries, comparisonSeries, comparisonLabel, granularityLabel } =
    getWindowSeries(dailySeries, range);

  if (loading) {
    return <p className="state">Loading engagement trends...</p>;
  }

  if (error) {
    return <p className="state state--error">Error: {error}</p>;
  }

  if (metrics.length === 0) {
    return <p className="state">No engagement data available yet.</p>;
  }

  if (chartSeries.length === 0) {
    return <p className="state">No engagement data available yet.</p>;
  }

  const averageReads = average(chartSeries.map((point) => point.reads));
  const peakReads = Math.max(...chartSeries.map((point) => point.reads));
  const averageReplies = average(chartSeries.map((point) => point.replies));
  const peakReplies = Math.max(...chartSeries.map((point) => point.replies));

  const chartData = chartSeries.map((p) => ({
    ...p,
    combined: p.reads + p.replies,
  }));
  const comparisonData = comparisonSeries.map((p) => ({
    ...p,
    combined: p.reads + p.replies,
  }));

  const averageCombined = average(chartData.map((p) => p.combined || 0));
  const peakCombined = Math.max(...chartData.map((p) => p.combined || 0));

  const currentAverageCombined = average(chartData.map((p) => p.combined || 0));
  const previousAverageCombined = average(
    comparisonData.map((p) => p.combined || 0),
  );
  const combinedTrendDelta =
    comparisonData.length > 0 && previousAverageCombined > 0
      ? ((currentAverageCombined - previousAverageCombined) /
          previousAverageCombined) *
        100
      : null;

  const currentAverageReads = average(chartSeries.map((point) => point.reads));
  const previousAverageReads = average(
    comparisonSeries.map((point) => point.reads),
  );
  const readsTrendDelta =
    comparisonSeries.length > 0 && previousAverageReads > 0
      ? ((currentAverageReads - previousAverageReads) / previousAverageReads) *
        100
      : null;

  const currentAverageReplies = average(
    chartSeries.map((point) => point.replies),
  );
  const previousAverageReplies = average(
    comparisonSeries.map((point) => point.replies),
  );
  const repliesTrendDelta =
    comparisonSeries.length > 0 && previousAverageReplies > 0
      ? ((currentAverageReplies - previousAverageReplies) /
          previousAverageReplies) *
        100
      : null;
  return (
    <section className="engagement-view">
      <div className="engagement-panel">
        <div className="engagement-panel__header">
          <div>
            <h2>Engagement over time</h2>
            <p>
              Shows daily reads (chapters opened) and replies (notes created).
              This view shows whether the product is gaining or losing momentum.
            </p>
          </div>

          <div
            className="engagement-range-toggle"
            role="tablist"
            aria-label="Engagement range"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`range-button ${range === option.key ? "active" : ""}`}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="engagement-summary">
          <section className="engagement-summary-group">
            <div className="engagement-summary-group__title">
              Current volume
            </div>
            <div className="engagement-summary-grid">
              <article className="engagement-summary-card">
                <span className="engagement-summary-label">Reads</span>
                <strong>{formatCount(averageReads)}</strong>
                <span>
                  {granularityLabel.toLowerCase()} (peak:{" "}
                  {formatCount(peakReads)})
                </span>
              </article>

              <article className="engagement-summary-card">
                <span className="engagement-summary-label">Replies</span>
                <strong>{formatCount(averageReplies)}</strong>
                <span>
                  {granularityLabel.toLowerCase()} (peak:{" "}
                  {formatCount(peakReplies)})
                </span>
              </article>

              <article className="engagement-summary-card engagement-summary-card--accent">
                <span className="engagement-summary-label">Combined</span>
                <strong>{formatCount(averageCombined)}</strong>
                <span>
                  {granularityLabel.toLowerCase()} (peak:{" "}
                  {formatCount(peakCombined)})
                </span>
              </article>
            </div>
          </section>

          <section className="engagement-summary-group">
            <div className="engagement-summary-group__title">
              Momentum vs previous period
            </div>
            <div className="engagement-summary-grid">
              <article className="engagement-summary-card">
                <span className="engagement-summary-label">Reads trend</span>
                <strong
                  className={
                    readsTrendDelta !== null && readsTrendDelta >= 0
                      ? "trend-positive"
                      : "trend-negative"
                  }
                >
                  {readsTrendDelta !== null
                    ? formatPercent(readsTrendDelta)
                    : "—"}
                </strong>
                <span>
                  {readsTrendDelta !== null
                    ? `vs ${comparisonLabel}`
                    : "Not enough history"}
                </span>
              </article>

              <article className="engagement-summary-card">
                <span className="engagement-summary-label">Replies trend</span>
                <strong
                  className={
                    repliesTrendDelta !== null && repliesTrendDelta >= 0
                      ? "trend-positive"
                      : "trend-negative"
                  }
                >
                  {repliesTrendDelta !== null
                    ? formatPercent(repliesTrendDelta)
                    : "—"}
                </strong>
                <span>
                  {repliesTrendDelta !== null
                    ? `vs ${comparisonLabel}`
                    : "Not enough history"}
                </span>
              </article>

              <article className="engagement-summary-card engagement-summary-card--accent">
                <span className="engagement-summary-label">Combined trend</span>
                <strong
                  className={
                    combinedTrendDelta !== null && combinedTrendDelta >= 0
                      ? "trend-positive"
                      : "trend-negative"
                  }
                >
                  {combinedTrendDelta !== null
                    ? formatPercent(combinedTrendDelta)
                    : "—"}
                </strong>
                <span>
                  {combinedTrendDelta !== null
                    ? `vs ${comparisonLabel}`
                    : "Not enough history"}
                </span>
              </article>
            </div>
          </section>
        </div>

        <div className="engagement-chart-shell">
          <div className="engagement-chart-meta">
            <span>{granularityLabel}</span>
          </div>

          <div
            className="engagement-chart"
            aria-label={`Engagement chart for ${range}`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 0, bottom: 18 }}
              >
                <CartesianGrid
                  stroke="#e9e5db"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "#d9d3c4" }}
                  tick={{ fill: "#6b6b6b", fontSize: 11 }}
                  minTickGap={18}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b6b6b", fontSize: 11 }}
                  width={34}
                />
                <Tooltip content={<EngagementTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="reads"
                  stroke="#1f6f8b"
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: "#ffffff",
                    stroke: "#1f6f8b",
                    strokeWidth: 1,
                  }}
                  activeDot={{ r: 5 }}
                  name="Reads"
                />
                <Line
                  type="monotone"
                  dataKey="replies"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: "#ffffff",
                    stroke: "#d97706",
                    strokeWidth: 1,
                  }}
                  activeDot={{ r: 5 }}
                  name="Replies"
                />
                <Line
                  type="monotone"
                  dataKey="combined"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                  name="Combined"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
