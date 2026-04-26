'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, AlertTriangle, Activity, Trash2, ExternalLink } from 'lucide-react';
import { useLiveStream, type LiveEvent } from '@/lib/sse';

interface Item extends LiveEvent {
  id: string;
}

const STORAGE_KEY = 'openbench_notifications_log';
const MAX_KEEP = 200;

function loadStored(): Item[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Item[]) : [];
  } catch {
    return [];
  }
}

function saveStored(items: Item[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_KEEP)));
  } catch {
    // ignore
  }
}

function describe(event: LiveEvent): { title: string; description: string; runId?: string } {
  const data = event.data || {};
  const runId = typeof data.run_id === 'string' ? (data.run_id as string) : undefined;
  const map: Record<string, string> = {
    run_created: 'Run created',
    run_started: 'Run started',
    run_paused: 'Run paused',
    run_resumed: 'Run resumed',
    run_cancelled: 'Run cancelled',
    run_state_changed: 'Run state changed',
    step_started: 'Step started',
    step_completed: 'Step completed',
    deviation_added: 'Deviation logged',
    deviation_recorded: 'Deviation recorded',
    block_triggered: 'Run blocked',
    override_resolved: 'Override resolved',
    escalation_raised: 'Escalation raised',
    override_requested: 'Override requested',
    ready: 'Live stream ready',
  };
  const title = map[event.type] || event.type.replace(/_/g, ' ');
  const description = runId ? `Run ${runId}` : Object.keys(data).length ? JSON.stringify(data) : '';
  return { title, description, runId };
}

function severityClass(type: string): string {
  if (type === 'escalation_raised') return 'border-red-500/30 bg-red-500/5';
  if (
    type === 'deviation_added' ||
    type === 'deviation_recorded' ||
    type === 'override_requested'
  )
    return 'border-amber-500/30 bg-amber-500/5';
  if (type === 'run_started' || type === 'run_resumed' || type === 'step_started')
    return 'border-cyan-500/20 bg-cyan-500/5';
  if (type === 'run_completed') return 'border-emerald-500/20 bg-emerald-500/5';
  return 'border-border';
}

export default function NotificationsContent() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    setItems(loadStored());
  }, []);

  const { connected } = useLiveStream({
    onEvent: (ev) => {
      if (ev.type === 'ready') return;
      setItems((prev) => {
        const next: Item[] = [
          { ...ev, id: `${ev.receivedAt}-${Math.random().toString(36).slice(2, 8)}` },
          ...prev,
        ].slice(0, MAX_KEEP);
        saveStored(next);
        return next;
      });
    },
  });

  const stats = useMemo(() => {
    return {
      total: items.length,
      escalations: items.filter((i) => i.type === 'escalation_raised').length,
      deviations: items.filter(
        (i) => i.type === 'deviation_added' || i.type === 'deviation_recorded'
      ).length,
    };
  }, [items]);

  const clear = () => {
    setItems([]);
    saveStored([]);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 ${
                connected ? 'text-emerald-400' : 'text-zinc-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'
                }`}
              />
              {connected ? 'Live stream connected' : 'Live stream offline'}
            </span>
            <span>·</span>
            <span>{stats.total} events received</span>
          </p>
        </div>
        <button
          onClick={clear}
          disabled={items.length === 0}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} /> Clear
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider">
            <Activity size={12} /> Total
          </div>
          <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">{stats.total}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 text-[11px] uppercase tracking-wider">
            <AlertTriangle size={12} /> Deviations
          </div>
          <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">{stats.deviations}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 text-[11px] uppercase tracking-wider">
            <Bell size={12} /> Escalations
          </div>
          <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">
            {stats.escalations}
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="px-5 py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <BellOff size={28} className="text-muted-foreground/50" />
            <p className="text-[13px]">No notifications yet.</p>
            <p className="text-[12px] max-w-md">
              {connected
                ? 'Live events will appear here as they happen — start a run, record a deviation, or raise an escalation.'
                : 'Connect to the live stream to receive real-time events.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[640px] overflow-y-auto scrollbar-thin">
            {items.map((item) => {
              const { title, description, runId } = describe(item);
              return (
                <div key={item.id} className={`px-5 py-3 border-l-2 ${severityClass(item.type)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground">{title}</p>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                        {item.type}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(item.receivedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {description && (
                    <p className="text-[12px] text-muted-foreground mt-1 break-all">
                      {description}
                    </p>
                  )}
                  {runId && (
                    <Link
                      href={`/run-detail?id=${runId}`}
                      className="inline-flex items-center gap-1 mt-1 text-[11px] text-primary hover:underline"
                    >
                      Open run <ExternalLink size={10} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
