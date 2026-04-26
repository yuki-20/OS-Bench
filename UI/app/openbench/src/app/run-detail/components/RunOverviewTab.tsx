'use client';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  CircleDashed,
  Play,
  SkipForward,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api, ApiError, type ProtocolStepOut, type StepStateOut } from '@/lib/api';
import { useRunDetail } from './RunDetailContext';

function statusIcon(status: string) {
  if (status === 'completed') return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (status === 'blocked') return <XCircle size={14} className="text-red-400" />;
  if (status === 'in_progress')
    return <CircleDashed size={14} className="text-cyan-400 animate-spin" />;
  if (status === 'skipped') return <AlertTriangle size={14} className="text-amber-400" />;
  return <Clock size={14} className="text-zinc-600" />;
}

function stepBg(status: string) {
  if (status === 'completed') return 'border-emerald-500/20 bg-emerald-500/5';
  if (status === 'blocked') return 'border-red-500/30 bg-red-500/8';
  if (status === 'in_progress') return 'border-cyan-500/30 bg-cyan-500/5';
  if (status === 'skipped') return 'border-amber-500/20 bg-amber-500/5';
  return 'border-border bg-transparent';
}

function durationBetween(a?: string | null, b?: string | null) {
  if (!a) return '—';
  const start = new Date(a).getTime();
  const end = b ? new Date(b).getTime() : Date.now();
  const ms = end - start;
  if (ms < 0 || Number.isNaN(ms)) return '—';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function RunOverviewTab() {
  const { detail, protocol, stepsById, refresh } = useRunDetail();
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState<Record<string, string>>({});

  const sortedSteps = useMemo<ProtocolStepOut[]>(() => {
    if (!protocol) return [];
    return [...protocol.steps].sort((a, b) => a.order_index - b.order_index);
  }, [protocol]);

  const stateByStepId = useMemo(() => {
    const map = new Map<string, StepStateOut>();
    for (const s of detail?.step_states ?? []) map.set(s.step_id, s);
    return map;
  }, [detail]);

  if (!detail) return null;

  const runActive =
    detail.run.status === 'active' ||
    detail.run.status === 'blocked' ||
    detail.run.status === 'awaiting_override';

  const counts = sortedSteps.reduce(
    (acc, s) => {
      const state = stateByStepId.get(s.id);
      const status = state?.status ?? 'not_started';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    { completed: 0, in_progress: 0, blocked: 0, skipped: 0, not_started: 0 } as Record<
      string,
      number
    >
  );

  const start = async (stepId: string) => {
    setBusy(`start-${stepId}`);
    try {
      await api.startStep(detail.run.id, stepId, `manual-start-${stepId}-${Date.now()}`);
      await refresh();
      toast.success('Step started');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const complete = async (stepId: string, overrideBlock = false) => {
    setBusy(`complete-${stepId}`);
    try {
      await api.completeStep(detail.run.id, stepId, {
        idempotency_key: `manual-complete-${stepId}-${Date.now()}`,
        confirmations: { manual: true },
        override_block: overrideBlock,
      });
      await refresh();
      toast.success(overrideBlock ? 'Step completed (block overridden)' : 'Step completed');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const skip = async (stepId: string) => {
    const reason = skipReason[stepId]?.trim();
    if (!reason) {
      toast.error('Provide a reason to skip the step');
      return;
    }
    setBusy(`skip-${stepId}`);
    try {
      await api.skipStep(detail.run.id, stepId, reason, `manual-skip-${stepId}-${Date.now()}`);
      await refresh();
      setSkipReason((prev) => ({ ...prev, [stepId]: '' }));
      toast.success('Step skipped');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  // Fallback when we don't have the protocol detail (rare).
  if (sortedSteps.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground">
        {protocol === null ? 'Loading protocol steps…' : 'This protocol has no steps defined.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="text-[13px] font-semibold text-foreground">
          Step-by-step ({sortedSteps.length} total)
        </h4>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-400" /> {counts.completed} done
          </span>
          <span className="flex items-center gap-1">
            <CircleDashed size={11} className="text-cyan-400" /> {counts.in_progress} active
          </span>
          <span className="flex items-center gap-1">
            <XCircle size={11} className="text-red-400" /> {counts.blocked} blocked
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={11} className="text-amber-400" /> {counts.skipped} skipped
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} className="text-zinc-600" /> {counts.not_started} pending
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {sortedSteps.map((step, idx) => {
          const state = stateByStepId.get(step.id);
          const status = state?.status ?? 'not_started';
          const isCurrent = detail.run.current_step_id === step.id;
          const isOpen = expanded === step.id;
          const canStart = runActive && status === 'not_started';
          const canComplete = runActive && (status === 'in_progress' || status === 'blocked');
          const canSkip = runActive && status !== 'completed' && status !== 'skipped';
          return (
            <div
              key={step.id}
              className={`border rounded-lg transition-all ${stepBg(status)} ${
                isCurrent ? 'ring-1 ring-primary/50' : ''
              }`}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : step.id)}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                {statusIcon(status)}
                <span className="font-mono text-[11px] text-muted-foreground w-12 shrink-0">
                  S{(idx + 1).toString().padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-foreground">{step.title}</p>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-primary bg-primary/15 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                    {status.replace(/_/g, ' ')} ·{' '}
                    {durationBetween(state?.started_at, state?.completed_at)}
                    {state?.blocked_reason_json &&
                      typeof state.blocked_reason_json === 'object' &&
                      ' reason' in (state.blocked_reason_json as Record<string, unknown>) && (
                        <span className="text-amber-400 ml-2">
                          — {(state.blocked_reason_json as { reason: string }).reason}
                        </span>
                      )}
                  </p>
                </div>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isOpen && (
                <div className="px-4 py-3 border-t border-border space-y-3 bg-zinc-950">
                  {step.instruction && (
                    <p className="text-[12px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {step.instruction}
                    </p>
                  )}

                  {(step.required_ppe_json.length > 0 ||
                    step.materials_json.length > 0 ||
                    step.equipment_json.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                      {step.required_ppe_json.length > 0 && (
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wider mb-1">PPE</p>
                          <ul className="text-foreground list-disc list-inside">
                            {step.required_ppe_json.map((p, i) => (
                              <li key={`ppe-${i}`}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {step.materials_json.length > 0 && (
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wider mb-1">
                            Materials
                          </p>
                          <ul className="text-foreground list-disc list-inside">
                            {step.materials_json.slice(0, 5).map((p, i) => (
                              <li key={`mat-${i}`}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {step.equipment_json.length > 0 && (
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wider mb-1">
                            Equipment
                          </p>
                          <ul className="text-foreground list-disc list-inside">
                            {step.equipment_json.slice(0, 5).map((p, i) => (
                              <li key={`eq-${i}`}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {step.visual_checks_json.length > 0 && (
                    <div className="text-[11px]">
                      <p className="text-muted-foreground uppercase tracking-wider mb-1">
                        Visual checks
                      </p>
                      <ul className="text-foreground list-disc list-inside space-y-0.5">
                        {step.visual_checks_json.map((c, i) => (
                          <li key={`vc-${i}`}>{c.description}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {runActive && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {canStart && (
                        <button
                          onClick={() => start(step.id)}
                          disabled={busy !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-lg text-[12px] font-medium text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50"
                        >
                          {busy === `start-${step.id}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} />
                          )}
                          Start step
                        </button>
                      )}
                      {canComplete && (
                        <>
                          <button
                            onClick={() => complete(step.id, false)}
                            disabled={busy !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {busy === `complete-${step.id}` ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            Complete
                          </button>
                          {status === 'blocked' && (
                            <button
                              onClick={() => complete(step.id, true)}
                              disabled={busy !== null}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/30 rounded-lg text-[12px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                            >
                              Override block
                            </button>
                          )}
                        </>
                      )}
                      {canSkip && (
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <input
                            value={skipReason[step.id] ?? ''}
                            onChange={(e) =>
                              setSkipReason((prev) => ({ ...prev, [step.id]: e.target.value }))
                            }
                            placeholder="reason to skip…"
                            className="flex-1 bg-zinc-900 border border-border rounded-lg px-2 py-1 text-[11px]"
                          />
                          <button
                            onClick={() => skip(step.id)}
                            disabled={busy !== null}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-lg text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {busy === `skip-${step.id}` ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <SkipForward size={11} />
                            )}
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
