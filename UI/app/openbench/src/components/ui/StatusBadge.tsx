import React from 'react';

type RunStatus =
  | 'active'
  | 'preflight'
  | 'paused'
  | 'blocked'
  | 'awaiting_override'
  | 'completed'
  | 'cancelled'
  | 'closed'
  | 'deviated';
type DeviationSeverity = 'critical' | 'major' | 'minor';
type ResolutionState = 'open' | 'under_review' | 'resolved';

interface StatusBadgeProps {
  status: RunStatus | DeviationSeverity | ResolutionState | string;
  type?: 'run' | 'severity' | 'resolution' | 'protocol';
  size?: 'sm' | 'md';
}

const runColors: Record<string, string> = {
  active: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  preflight: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  paused: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  blocked: 'bg-red-500/15 text-red-400 border-red-500/30',
  awaiting_override: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-zinc-600/15 text-zinc-500 border-zinc-600/30',
  closed: 'bg-zinc-600/15 text-zinc-500 border-zinc-600/30',
  deviated: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  major: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  minor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const resolutionColors: Record<string, string> = {
  open: 'bg-red-500/15 text-red-400 border-red-500/30',
  under_review: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const protocolColors: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  in_review: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  archived: 'bg-zinc-600/15 text-zinc-500 border-zinc-600/30',
};

export default function StatusBadge({ status, type = 'run', size = 'sm' }: StatusBadgeProps) {
  let colorClass = '';
  if (type === 'run')
    colorClass = runColors[status] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  else if (type === 'severity')
    colorClass = severityColors[status] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  else if (type === 'resolution')
    colorClass = resolutionColors[status] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  else if (type === 'protocol')
    colorClass = protocolColors[status] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';

  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center border rounded-full font-medium capitalize
      ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'}
      ${colorClass}`}
    >
      {label}
    </span>
  );
}
