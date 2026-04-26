'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, ApiError, type DeviationOut } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

interface DevPoint {
  date: string;
  critical: number;
  major: number;
  minor: number;
}

const DAYS = 14;

function bucketSeverity(severity: string): keyof Omit<DevPoint, 'date'> | null {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high') return 'critical';
  if (s === 'major' || s === 'moderate') return 'major';
  if (s === 'minor' || s === 'low') return 'minor';
  return 'minor';
}

function buildBuckets(deviations: DeviationOut[]): DevPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const points: DevPoint[] = [];
  const indexByKey = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      critical: 0,
      major: 0,
      minor: 0,
    });
    indexByKey.set(key, points.length - 1);
  }
  for (const d of deviations) {
    if (!d.created_at) continue;
    const key = d.created_at.slice(0, 10);
    const idx = indexByKey.get(key);
    if (idx === undefined) continue;
    const bucket = bucketSeverity(d.severity);
    if (bucket) points[idx][bucket] += 1;
  }
  return points;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; dataKey?: string; color?: string; value?: number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-border rounded-lg px-3 py-2.5 shadow-xl">
      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={`tt-dev-${p.dataKey}`} className="flex items-center gap-2 text-[12px]">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DeviationTrendChart() {
  const [deviations, setDeviations] = useState<DeviationOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.listDeviations();
      setDeviations(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useLiveStream({
    onEvent: (ev) => {
      if (
        ev.type === 'deviation_added' ||
        ev.type === 'deviation_recorded' ||
        ev.type.startsWith('run_')
      )
        refresh();
    },
  });

  const data = useMemo(() => buildBuckets(deviations), [deviations]);
  const range = useMemo(() => {
    if (data.length === 0) return '';
    return `${data[0].date} – ${data[data.length - 1].date}`;
  }, [data]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Deviation Trends</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `By severity — ${deviations.length} total in window`}
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">{range}</span>
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {error}
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          barSize={7}
          barGap={2}
        >
          <CartesianGrid stroke="hsl(240,6%,14%)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(240,5%,55%)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(240,5%,55%)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12, color: 'hsl(240,5%,55%)' }}
            iconType="circle"
            iconSize={7}
          />
          <Bar dataKey="critical" name="Critical" fill="hsl(0,72%,51%)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="major" name="Major" fill="hsl(38,92%,50%)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="minor" name="Minor" fill="hsl(189,94%,43%)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
