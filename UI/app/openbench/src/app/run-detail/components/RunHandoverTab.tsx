'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, AlertTriangle, Sparkles } from 'lucide-react';
import { ApiError, API_BASE_URL, apiRequest } from '@/lib/api';
import { useRunDetail } from './RunDetailContext';

interface HandoverPayload {
  run_id: string;
  status?: string;
  summary?: string;
  highlights?: string[];
  open_items?: string[];
  generated_at?: string;
  finalized?: boolean;
  [key: string]: unknown;
}

export default function RunHandoverTab() {
  const { runId, detail } = useRunDetail();
  const [handover, setHandover] = useState<HandoverPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const res = await apiRequest<HandoverPayload>(`/api/runs/${runId}/handover`);
      setHandover(res);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setHandover(null);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : (err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    if (!runId) return;
    setBusy('generate');
    try {
      const res = await apiRequest<HandoverPayload>(`/api/runs/${runId}/handover/generate`, {
        method: 'POST',
      });
      setHandover(res);
      toast.success('Handover report generated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const finalize = async () => {
    if (!runId) return;
    setBusy('finalize');
    try {
      const res = await apiRequest<HandoverPayload>(`/api/runs/${runId}/handover/finalize`, {
        method: 'POST',
      });
      setHandover(res);
      toast.success('Handover finalized');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = () => {
    if (!runId) return;
    window.open(`${API_BASE_URL}/api/runs/${runId}/handover/pdf`, '_blank');
  };

  if (!detail) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-foreground">Handover Report</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={busy !== null || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/30 rounded-lg text-[12px] font-medium text-primary hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles size={13} />
            {busy === 'generate' ? 'Generating…' : handover ? 'Regenerate' : 'Generate'}
          </button>
          {handover && !handover.finalized && (
            <button
              onClick={finalize}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <FileText size={13} />
              {busy === 'finalize' ? 'Finalizing…' : 'Finalize'}
            </button>
          )}
          {handover && (
            <button
              onClick={downloadPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-border rounded-lg text-[12px] font-medium text-foreground hover:bg-zinc-700 transition-all active:scale-95"
            >
              <Download size={13} /> PDF
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-muted-foreground text-[13px]">Loading handover…</p>
      ) : !handover ? (
        <div className="text-center py-10 text-[13px] text-muted-foreground flex flex-col items-center gap-2">
          <FileText size={24} className="text-muted-foreground/50" />
          No handover report yet for this run.
          <p className="text-[12px]">
            Click <span className="text-primary">Generate</span> to compile one from the run state.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {handover.summary && (
            <div className="border border-border rounded-lg p-4">
              <h5 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Summary
              </h5>
              <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                {handover.summary}
              </p>
            </div>
          )}
          {handover.highlights && handover.highlights.length > 0 && (
            <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-4">
              <h5 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Highlights
              </h5>
              <ul className="space-y-1 text-[13px] text-foreground list-disc list-inside">
                {handover.highlights.map((h, idx) => (
                  <li key={`hi-${idx}`}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {handover.open_items && handover.open_items.length > 0 && (
            <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg p-4">
              <h5 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-400" /> Open Items
              </h5>
              <ul className="space-y-1 text-[13px] text-foreground list-disc list-inside">
                {handover.open_items.map((h, idx) => (
                  <li key={`oi-${idx}`}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="border border-border rounded-lg">
            <summary className="cursor-pointer text-[12px] text-muted-foreground px-4 py-2 hover:bg-white/[0.02]">
              Raw handover payload
            </summary>
            <pre className="text-[11px] font-mono text-muted-foreground bg-zinc-950 p-3 overflow-x-auto max-h-80 whitespace-pre-wrap">
              {JSON.stringify(handover, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
