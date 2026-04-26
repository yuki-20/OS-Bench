'use client';
import React, { useState } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useRunDetail } from './RunDetailContext';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function RunDeviationsTab() {
  const { detail, refresh } = useRunDetail();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  if (!detail) return null;

  const deviations = [...detail.deviations].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const handleResolve = async (deviationId: string) => {
    setResolving(deviationId);
    try {
      await api.resolveDeviation(deviationId, { resolution_state: 'resolved' });
      await refresh();
      toast.success('Deviation resolved');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error('Manager role required to resolve deviations');
      } else {
        toast.error(
          err instanceof ApiError ? err.message : (err as Error).message || 'Failed to resolve'
        );
      }
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-foreground">
          Deviations ({deviations.length})
        </h4>
        <span className="text-[11px] text-muted-foreground">
          {deviations.filter((d) => d.resolution_state === 'open').length} open
        </span>
      </div>

      {deviations.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-muted-foreground">
          No deviations recorded for this run.
        </div>
      ) : (
        <div className="space-y-2">
          {deviations.map((dev) => {
            const isOpen = expanded === dev.id;
            const isResolved = dev.resolution_state === 'resolved';
            return (
              <div
                key={dev.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  isResolved ? 'border-emerald-500/20' : 'border-amber-500/30 bg-amber-500/5'
                }`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : dev.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <AlertTriangle
                    size={14}
                    className={isResolved ? 'text-emerald-400' : 'text-amber-400'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {dev.title}
                      </p>
                      <StatusBadge status={dev.severity} type="severity" />
                      <StatusBadge status={dev.resolution_state} type="run" size="sm" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                      {formatTime(dev.created_at)}
                      {dev.step_id && <span className="ml-2">step {dev.step_id.slice(-8)}</span>}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isOpen && (
                  <div className="px-4 py-3 border-t border-border bg-zinc-950 space-y-3">
                    {dev.description ? (
                      <p className="text-[12px] text-muted-foreground whitespace-pre-wrap">
                        {dev.description}
                      </p>
                    ) : (
                      <p className="text-[12px] text-muted-foreground italic">
                        No description provided.
                      </p>
                    )}
                    {!isResolved && (
                      <button
                        onClick={() => handleResolve(dev.id)}
                        disabled={resolving === dev.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Check size={13} />
                        {resolving === dev.id ? 'Resolving…' : 'Mark resolved'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
