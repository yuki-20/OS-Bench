'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { ExternalLink, Eye } from 'lucide-react';
import { api, ApiError, type RecentRun } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

function formatStarted(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}

function shortId(value: string | null | undefined, prefix: string) {
  if (!value) return '—';
  return `${prefix}-${value.slice(-6)}`;
}

export default function ActiveRunsTable() {
  const [runs, setRuns] = useState<RecentRun[]>([]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.dashboardRecentRuns(12);
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
      if (ev.type.startsWith('run_') || ev.type.startsWith('step_')) refresh();
    },
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Recent Runs</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {loading
              ? 'Loading…'
              : `Live status — ${runs.length} run${runs.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link
          href="/run-monitor"
          className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary/80 transition-colors"
        >
          View all <ExternalLink size={12} />
        </Link>
      </div>
      {error && (
        <div className="px-5 py-2 text-[12px] text-red-300 bg-red-500/10 border-b border-red-500/20">
          Failed to load runs: {error}
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {['Run ID', 'Operator', 'Status', 'Started', 'Ended']?.map((col) => (
                <th
                  key={`col-${col}`}
                  className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {!loading && runs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground text-[13px]"
                >
                  No runs yet. Start one from the operator app to see it here.
                </td>
              </tr>
            )}
            {runs.map((run) => (
              <tr
                key={run.id}
                onMouseEnter={() => setHoveredRow(run.id)}
                onMouseLeave={() => setHoveredRow(null)}
                className={`border-b border-border/50 transition-colors ${
                  hoveredRow === run.id ? 'bg-white/[0.03]' : ''
                } ${run.status === 'blocked' ? 'animate-pulse-once' : ''}`}
              >
                <td className="px-4 py-3 font-mono text-[12px] text-primary whitespace-nowrap">
                  <Link href={`/run-detail?id=${run.id}`} className="hover:underline">
                    {run.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                  {shortId(run.operator_id, 'op')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={run.status} type="run" />
                </td>
                <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                  {formatStarted(run.started_at)}
                </td>
                <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                  {formatStarted(run.ended_at)}
                </td>
                <td className="px-4 py-3">
                  {hoveredRow === run.id && (
                    <Link
                      href={`/run-detail?id=${run.id}`}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                    >
                      <Eye size={12} /> View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
