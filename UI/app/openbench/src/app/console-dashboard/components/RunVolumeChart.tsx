'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, ApiError, type RunOut } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

interface VolumePoint {
  date: string;
  runs: number;
  completed: number;
}

const DAYS = 14;

function buildBuckets(runs: RunOut[]): VolumePoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const points: VolumePoint[] = [];
  const indexByKey = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      runs: 0,
      completed: 0,
    });
    indexByKey.set(key, points.length - 1);
  }

  for (const run of runs) {
    if (run.created_at) {
      const key = run.created_at.slice(0, 10);
      const idx = indexByKey.get(key);
      if (idx !== undefined) points[idx].runs += 1;
    }
    if (run.ended_at && (run.status === 'completed' || run.status === 'closed')) {
      const key = run.ended_at.slice(0, 10);
      const idx = indexByKey.get(key);
      if (idx !== undefined) points[idx].completed += 1;
    }
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
        <div key={`tt-${p.dataKey}`} className="flex items-center gap-2 text-[12px]">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function RunVolumeChart() {
  const [runs, setRuns] = useState<RunOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.listRuns();
      setRuns(res);
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
      if (ev.type.startsWith('run_')) refresh();
    },
  });

  const data = useMemo(() => buildBuckets(runs), [runs]);
  const range = useMemo(() => {
    if (data.length === 0) return '';
    return `${data[0].date} – ${data[data.length - 1].date}`;
  }, [data]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Run Volume</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `Last ${DAYS} days — ${runs.length} runs total`}
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
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradRuns" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(189,94%,43%)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(189,94%,43%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(158,64%,40%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(158,64%,40%)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="runs"
            name="Started"
            stroke="hsl(189,94%,43%)"
            strokeWidth={2}
            fill="url(#gradRuns)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke="hsl(158,64%,40%)"
            strokeWidth={2}
            fill="url(#gradCompleted)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
