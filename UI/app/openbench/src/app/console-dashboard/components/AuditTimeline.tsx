'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  User,
  Settings,
  FileText,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react';
import { api, ApiError, type AuditLogOut } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

interface VisualEvent {
  id: string;
  icon: typeof Shield;
  color: string;
  action: string;
  desc: string;
  actor: string;
  target: string;
  time: string;
}

function classify(action: string): { icon: typeof Shield; color: string } {
  if (action.includes('block') || action.includes('escalat')) {
    return { icon: Shield, color: 'text-red-400 bg-red-500/10' };
  }
  if (action.includes('deviation') || action.includes('override')) {
    return { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10' };
  }
  if (action.includes('start') || action.startsWith('run.')) {
    return { icon: FlaskConical, color: 'text-cyan-400 bg-cyan-500/10' };
  }
  if (action.includes('publish') || action.includes('protocol')) {
    return { icon: FileText, color: 'text-emerald-400 bg-emerald-500/10' };
  }
  if (action.includes('complete') || action.includes('handover')) {
    return { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' };
  }
  if (action.includes('role') || action.includes('user') || action.includes('invite')) {
    return { icon: User, color: 'text-blue-400 bg-blue-500/10' };
  }
  if (action.includes('settings')) {
    return { icon: Settings, color: 'text-zinc-400 bg-zinc-500/10' };
  }
  return { icon: Activity, color: 'text-zinc-400 bg-zinc-500/10' };
}

function shortId(value: string | null | undefined, fallback = 'unknown') {
  if (!value) return fallback;
  return value.slice(-8);
}

function toVisual(event: AuditLogOut): VisualEvent {
  const { icon, color } = classify(event.action);
  let time = '—';
  try {
    time = new Date(event.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    time = event.created_at.slice(11, 16);
  }
  return {
    id: event.id,
    icon,
    color,
    action: event.action,
    desc: event.summary || event.action,
    actor: shortId(event.actor_id, 'system'),
    target: event.target_id ? `${event.target_type ?? ''} ${shortId(event.target_id)}`.trim() : '—',
    time,
  };
}

export default function AuditTimeline() {
  const [events, setEvents] = useState<VisualEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.listAuditLog(20);
      setEvents(res.map(toVisual));
      setError(null);
      setPermissionDenied(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPermissionDenied(true);
      } else {
        setError(err instanceof ApiError ? err.message : (err as Error).message);
      }
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
        ev.type.startsWith('run_') ||
        ev.type.startsWith('step_') ||
        ev.type === 'deviation_added' ||
        ev.type === 'deviation_recorded' ||
        ev.type === 'escalation_raised' ||
        ev.type === 'override_requested'
      ) {
        refresh();
      }
    },
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Audit Timeline</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {permissionDenied
              ? 'Manager role required'
              : loading
                ? 'Loading…'
                : `Last ${events.length} events`}
          </p>
        </div>
        <Link
          href="/audit-log"
          className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary/80 transition-colors"
        >
          Full log <ExternalLink size={12} />
        </Link>
      </div>
      {error && (
        <div className="px-5 py-2 text-[12px] text-red-300 bg-red-500/10 border-b border-red-500/20">
          {error}
        </div>
      )}
      <div className="overflow-y-auto max-h-[420px] scrollbar-thin">
        {!loading && events.length === 0 && !permissionDenied && (
          <div className="px-5 py-10 text-center text-[12px] text-muted-foreground">
            No audit events yet.
          </div>
        )}
        {permissionDenied && (
          <div className="px-5 py-10 text-center text-[12px] text-muted-foreground">
            Sign in as a manager or admin to see the audit timeline.
          </div>
        )}
        {events.map((event, idx) => {
          const Icon = event.icon;
          return (
            <div
              key={event.id}
              className="relative flex gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
            >
              {idx < events.length - 1 && (
                <div className="absolute left-[32px] top-10 bottom-0 w-px bg-border" />
              )}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 z-10 ${event.color.split(' ')[1]}`}
              >
                <Icon size={13} className={event.color.split(' ')[0]} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-foreground truncate">{event.action}</p>
                  <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                    {event.time}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{event.desc}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground font-mono">{event.actor}</span>
                  <span className="text-[10px] font-mono text-primary/70 truncate">
                    {event.target}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
