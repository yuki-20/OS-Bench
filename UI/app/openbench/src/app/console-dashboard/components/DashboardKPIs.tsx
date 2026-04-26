'use client';
import React, { useCallback, useEffect, useState } from 'react';
import MetricCard from '@/components/ui/MetricCard';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  FlaskConical,
} from 'lucide-react';
import { api, ApiError, type DashboardStats } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

export default function DashboardKPIs() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.dashboardStats();
      setStats(res);
      setError(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on every relevant live event so the cards always reflect the truth.
  useLiveStream({
    onEvent: (ev) => {
      if (
        ev.type === 'run_created' ||
        ev.type === 'run_started' ||
        ev.type === 'run_state_changed' ||
        ev.type === 'run_paused' ||
        ev.type === 'run_resumed' ||
        ev.type === 'run_cancelled' ||
        ev.type === 'run_completed' ||
        ev.type === 'deviation_added' ||
        ev.type === 'deviation_recorded' ||
        ev.type === 'escalation_raised'
      ) {
        refresh();
      }
    },
  });

  const value = (n: number | undefined) => (typeof n === 'number' ? n : loading ? '—' : 0);

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          Failed to load dashboard stats: {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <MetricCard
          label="Active Runs"
          value={value(stats?.active_runs)}
          subValue={loading ? 'Loading…' : `${stats?.active_runs ?? 0} currently active`}
          icon={Activity}
          hero
          className="2xl:col-span-1"
        />
        <MetricCard
          label="Blocked Runs"
          value={value(stats?.blocked_runs)}
          subValue={
            (stats?.blocked_runs ?? 0) > 0 ? 'Requires immediate review' : 'No blockers right now'
          }
          icon={ShieldAlert}
          alert={(stats?.blocked_runs ?? 0) > 0}
          className="2xl:col-span-1"
        />
        <MetricCard
          label="Open Deviations"
          value={value(stats?.deviations_open)}
          subValue={
            (stats?.deviations_open ?? 0) > 0 ? 'Awaiting reviewer triage' : 'No open deviations'
          }
          icon={AlertTriangle}
          warning={(stats?.deviations_open ?? 0) > 0}
          className="2xl:col-span-1"
        />
        <MetricCard
          label="Pending Handovers"
          value={value(stats?.pending_handovers)}
          subValue="Completed in last 7 days"
          icon={CheckCircle2}
          className="2xl:col-span-1"
        />
        <MetricCard
          label="Drafts in Review"
          value={value(stats?.drafts_in_review)}
          subValue="Protocol drafts awaiting publish"
          icon={Clock}
          warning={(stats?.drafts_in_review ?? 0) > 0}
          className="2xl:col-span-1"
        />
        <MetricCard
          label="Completed (7d)"
          value={value(stats?.completed_runs_7d)}
          subValue="Across the last 7 days"
          icon={FlaskConical}
          className="2xl:col-span-1"
        />
      </div>
    </div>
  );
}
