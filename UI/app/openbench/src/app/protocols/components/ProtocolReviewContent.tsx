'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  ChevronLeft,
  CheckCircle2,
  Archive,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Pencil,
  X,
  Save,
  PlayCircle,
} from 'lucide-react';
import { api, ApiError, type ProtocolStepOut, type ProtocolVersionDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Props {
  draftId: string;
}

export default function ProtocolReviewContent({ draftId }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [draft, setDraft] = useState<ProtocolVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProtocolStepOut>>({});

  const refresh = useCallback(async () => {
    try {
      // /api/protocol-drafts/{id} works for drafts, /api/protocol-versions/{id}
      // works for any state. Try draft first, fall back.
      let res: ProtocolVersionDetail;
      try {
        res = await api.getProtocolDraft(draftId);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          res = await api.getProtocolVersion(draftId);
        } else {
          throw err;
        }
      }
      setDraft(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isReviewerOrAbove =
    user?.role === 'reviewer' ||
    user?.role === 'manager' ||
    user?.role === 'safety_lead' ||
    user?.role === 'admin';

  const publish = async () => {
    if (!draft) return;
    if (!isReviewerOrAbove) {
      toast.error('Reviewer or higher role required to publish.');
      return;
    }
    setBusy('publish');
    try {
      const res = await api.publishProtocolDraft(draft.id);
      toast.success(`Published version ${res.version_label}`);
      router.push(`/protocols/${res.protocol_version_id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const archive = async () => {
    if (!draft) return;
    if (!confirm('Archive this version? It will no longer be runnable.')) return;
    setBusy('archive');
    try {
      await api.archiveProtocolVersion(draft.id);
      toast.success('Version archived');
      router.push('/protocols');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (step: ProtocolStepOut) => {
    setEditingStepId(step.id);
    setEditForm({
      title: step.title,
      instruction: step.instruction,
      is_skippable: step.is_skippable,
      reviewer_notes: step.reviewer_notes ?? '',
    });
  };

  const saveEdit = async () => {
    if (!draft || !editingStepId) return;
    setBusy(`step-${editingStepId}`);
    try {
      const updated = await api.patchProtocolDraft(draft.id, {
        patch_step_id: editingStepId,
        patch_step: editForm,
      });
      setDraft(updated);
      setEditingStepId(null);
      setEditForm({});
      toast.success('Step updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const startRunFromHere = async () => {
    if (!draft || draft.status !== 'published') return;
    setBusy('start-run');
    try {
      const run = await api.createRun({ protocol_version_id: draft.id });
      toast.success(`Run ${run.id} created`);
      router.push(`/run-detail?id=${run.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground text-[13px] flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading draft…
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
        Failed to load draft: {error || 'Not found'}
      </div>
    );
  }

  const isDraft = draft.status === 'draft' || draft.status === 'in_review';

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link
          href="/protocols"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft size={13} /> Protocols
        </Link>
        <span>/</span>
        <span className="font-mono">{draft.id.slice(-12)}</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-foreground">{draft.name}</h1>
              <StatusBadge status={draft.status} type="protocol" />
              <span className="font-mono text-[12px] text-muted-foreground">
                {draft.version_label}
              </span>
            </div>
            {draft.summary && (
              <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
                {draft.summary}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-muted-foreground font-mono">
              <span>{draft.steps.length} steps</span>
              <span>{draft.hazard_rules.length} hazard rules</span>
              <span>{draft.source_doc_ids?.length ?? 0} source docs</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                onClick={publish}
                disabled={busy !== null || !isReviewerOrAbove}
                title={!isReviewerOrAbove ? 'Reviewer role required' : undefined}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-[13px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'publish' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Publish
              </button>
            )}
            {draft.status === 'published' && (
              <button
                onClick={startRunFromHere}
                disabled={busy !== null}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {busy === 'start-run' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <PlayCircle size={14} />
                )}
                Start run
              </button>
            )}
            {draft.status !== 'archived' && (
              <button
                onClick={archive}
                disabled={busy !== null}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all disabled:opacity-50"
              >
                <Archive size={14} /> Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {draft.hazard_rules.length > 0 && (
        <div className="bg-card border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} className="text-amber-400" />
            <h3 className="text-[14px] font-semibold text-foreground">
              Hazards ({draft.hazard_rules.length})
            </h3>
          </div>
          <div className="space-y-2">
            {draft.hazard_rules.slice(0, 6).map((h) => (
              <div
                key={h.id}
                className="flex items-start gap-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10"
              >
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground">{h.requirement_text}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    {h.category} · severity {h.severity}
                  </p>
                </div>
              </div>
            ))}
            {draft.hazard_rules.length > 6 && (
              <p className="text-[11px] text-muted-foreground italic">
                + {draft.hazard_rules.length - 6} more hazard rules
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[14px] font-semibold text-foreground">
            Steps ({draft.steps.length})
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {isDraft
              ? 'Click any step to edit before publishing.'
              : 'Read-only — already published.'}
          </p>
        </div>
        <div className="divide-y divide-border">
          {[...draft.steps]
            .sort((a, b) => a.order_index - b.order_index)
            .map((step, idx) => {
              const isEditing = editingStepId === step.id;
              return (
                <div key={step.id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          S{(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <input
                          value={editForm.title ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="flex-1 bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[14px] font-semibold text-foreground"
                        />
                      </div>
                      <textarea
                        value={editForm.instruction ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, instruction: e.target.value })}
                        rows={4}
                        className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground"
                      />
                      <textarea
                        value={editForm.reviewer_notes ?? ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, reviewer_notes: e.target.value })
                        }
                        rows={2}
                        placeholder="Reviewer notes (optional)"
                        className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[12px] text-muted-foreground"
                      />
                      <label className="flex items-center gap-2 text-[12px] text-foreground">
                        <input
                          type="checkbox"
                          checked={!!editForm.is_skippable}
                          onChange={(e) =>
                            setEditForm({ ...editForm, is_skippable: e.target.checked })
                          }
                          className="accent-primary"
                        />
                        Step is skippable
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingStepId(null);
                            setEditForm({});
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                        >
                          <X size={12} /> Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={busy === `step-${step.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                          {busy === `step-${step.id}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0 mt-0.5">
                        S{(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-[14px] font-semibold text-foreground">{step.title}</p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                                step.confidence_score >= 0.85
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : step.confidence_score >= 0.6
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-red-500/15 text-red-400'
                              }`}
                            >
                              {(step.confidence_score * 100).toFixed(0)}%
                            </span>
                            {step.is_skippable && (
                              <span className="text-[10px] text-muted-foreground">skippable</span>
                            )}
                            {isDraft && (
                              <button
                                onClick={() => startEdit(step)}
                                className="text-muted-foreground hover:text-primary p-1 rounded"
                                title="Edit step"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {step.instruction && (
                          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
                            {step.instruction}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground font-mono">
                          {step.required_ppe_json.length > 0 && (
                            <span>PPE: {step.required_ppe_json.join(', ')}</span>
                          )}
                          {step.materials_json.length > 0 && (
                            <span>materials: {step.materials_json.length}</span>
                          )}
                          {step.equipment_json.length > 0 && (
                            <span>equipment: {step.equipment_json.length}</span>
                          )}
                          {step.timers_json.length > 0 && (
                            <span>timers: {step.timers_json.length}</span>
                          )}
                          {step.visual_checks_json.length > 0 && (
                            <span>visual checks: {step.visual_checks_json.length}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
