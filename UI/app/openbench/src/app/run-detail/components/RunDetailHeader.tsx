'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { ChevronLeft, AlertTriangle, Clock, User, Zap, Pause, Play, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useRunDetail } from './RunDetailContext';

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}

function durationFromStart(iso: string | null | undefined) {
  if (!iso) return '—';
  const started = new Date(iso).getTime();
  const ms = Date.now() - started;
  if (ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
}

export default function RunDetailHeader() {
  const { runId, detail, loading, error, refresh } = useRunDetail();
  const [busy, setBusy] = useState<string | null>(null);

  const stepProgress = useMemo(() => {
    if (!detail) return { passed: 0, total: 0 };
    const total = detail.step_states.length;
    const passed = detail.step_states.filter((s) => s.status === 'completed').length;
    return { passed, total };
  }, [detail]);

  if (!runId) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-[13px] text-muted-foreground">
        Pass <span className="font-mono text-primary">?id=&lt;run_id&gt;</span> to view a run. Or
        return to the{' '}
        <Link href="/run-monitor" className="text-primary hover:underline">
          run monitor
        </Link>
        .
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-[13px] text-muted-foreground">
        Loading run…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="bg-card border border-red-500/30 rounded-xl p-5 text-[13px] text-red-300">
        Failed to load run: {error || 'Run not found'}
      </div>
    );
  }

  const run = detail.run;
  const openDeviations = detail.deviations.filter((d) => d.resolution_state === 'open').length;

  const transition = async (kind: 'preflight' | 'start' | 'pause' | 'resume' | 'cancel') => {
    setBusy(kind);
    try {
      if (kind === 'preflight') await api.preflightRun(run.id);
      if (kind === 'start') await api.startRun(run.id);
      if (kind === 'pause') await api.pauseRun(run.id);
      if (kind === 'resume') await api.resumeRun(run.id);
      if (kind === 'cancel') await api.cancelRun(run.id);
      await refresh();
      toast.success(`Run ${kind}${kind === 'cancel' ? 'led' : kind === 'preflight' ? 'ed' : 'd'}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : (err as Error).message || `Failed to ${kind} run`
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-[12px] text-muted-foreground">
        <Link
          href="/run-monitor"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft size={13} /> Run Monitor
        </Link>
        <span>/</span>
        <span className="font-mono text-primary">{run.id}</span>
      </div>
      <div
        className={`bg-card border rounded-xl p-5 ${
          run.status === 'blocked' || run.status === 'awaiting_override'
            ? 'border-red-500/20'
            : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Zap size={22} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground font-mono">{run.id}</h1>
                <StatusBadge status={run.status} type="run" size="md" />
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-mono">
                  <User size={12} /> operator {run.operator_id.slice(-8)}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-mono">
                  protocol {run.protocol_version_id.slice(-8)}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Clock size={12} /> Started {formatTime(run.started_at)} —{' '}
                  {durationFromStart(run.started_at)} elapsed
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(run.status === 'created' || run.status === 'preflight') && (
              <button
                onClick={() => transition('start')}
                disabled={busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play size={13} /> Start run
              </button>
            )}
            {run.status === 'active' && (
              <button
                onClick={() => transition('pause')}
                disabled={busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[12px] font-medium text-foreground hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <Pause size={13} /> Pause
              </button>
            )}
            {(run.status === 'paused' || run.status === 'blocked') && (
              <button
                onClick={() => transition('resume')}
                disabled={busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play size={13} /> Resume
              </button>
            )}
            {run.status !== 'completed' &&
              run.status !== 'cancelled' &&
              run.status !== 'closed' && (
                <button
                  onClick={() => transition('cancel')}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-[12px] font-medium text-red-400 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <XCircle size={13} /> Cancel
                </button>
              )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Steps Completed
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width:
                      stepProgress.total > 0
                        ? `${(stepProgress.passed / stepProgress.total) * 100}%`
                        : '0%',
                  }}
                />
              </div>
              <span className="font-mono text-[12px] font-semibold text-foreground tabular-nums">
                {stepProgress.passed}/{stepProgress.total}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Events
            </p>
            <p className="font-semibold text-foreground mt-1 tabular-nums text-[14px]">
              {detail.events.length}
              <span className="text-muted-foreground text-[11px] ml-1">recorded</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Deviations
            </p>
            <p
              className={`font-semibold mt-1 tabular-nums text-[14px] flex items-center gap-1 ${
                openDeviations > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              <AlertTriangle size={13} /> {openDeviations} open
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Attachments
            </p>
            <p className="text-foreground text-[14px] mt-1 tabular-nums">
              {detail.attachments.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
