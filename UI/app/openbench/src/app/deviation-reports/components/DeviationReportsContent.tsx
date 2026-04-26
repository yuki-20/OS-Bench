'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Eye, ExternalLink, RefreshCw, Search, X } from 'lucide-react';
import { api, ApiError, type DeviationOut } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

const SEVERITY_OPTIONS = ['critical', 'high', 'major', 'moderate', 'minor'];
const STATE_OPTIONS = ['open', 'under_review', 'resolved'];

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function DeviationReportsContent() {
  const [deviations, setDeviations] = useState<DeviationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.listDeviations();
      setDeviations(res);
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
      if (
        ev.type === 'deviation_added' ||
        ev.type === 'deviation_recorded' ||
        ev.type === 'escalation_raised'
      )
        refresh();
    },
  });

  const filtered = useMemo(() => {
    let data = [...deviations];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.description ?? '').toLowerCase().includes(q) ||
          d.run_id.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
      );
    }
    if (stateFilter) data = data.filter((d) => d.resolution_state === stateFilter);
    if (severityFilter) data = data.filter((d) => d.severity === severityFilter);
    return data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [deviations, search, stateFilter, severityFilter]);

  const selected = useMemo(
    () => deviations.find((d) => d.id === selectedId) ?? null,
    [deviations, selectedId]
  );

  const counts = useMemo(() => {
    const open = deviations.filter((d) => d.resolution_state === 'open').length;
    const review = deviations.filter((d) => d.resolution_state === 'under_review').length;
    const resolved = deviations.filter((d) => d.resolution_state === 'resolved').length;
    return { open, review, resolved };
  }, [deviations]);

  const resolve = async (id: string) => {
    setResolving(id);
    try {
      await api.resolveDeviation(id, { resolution_state: 'resolved' });
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deviations</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {loading
              ? 'Loading…'
              : `${counts.open} open · ${counts.review} under review · ${counts.resolved} resolved`}
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all active:scale-95"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description, run id…"
            className="w-full bg-zinc-900 border border-border rounded-lg pl-8 pr-4 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer capitalize"
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">All states</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        {(search || severityFilter || stateFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setSeverityFilter('');
              setStateFilter('');
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground">{filtered.length} shown</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                    State
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                    Run
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                    Created
                  </th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-muted-foreground text-[13px]"
                    >
                      {deviations.length === 0
                        ? 'No deviations recorded yet.'
                        : 'No deviations match your filters.'}
                    </td>
                  </tr>
                )}
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`border-b border-border/40 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                      selectedId === d.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium truncate max-w-[260px]">
                        {d.title}
                      </p>
                      {d.requires_review && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                          <AlertTriangle size={10} /> requires review
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.severity} type="severity" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.resolution_state} type="resolution" />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-primary">
                      <Link
                        href={`/run-detail?id=${d.run_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline flex items-center gap-1"
                      >
                        {d.run_id.slice(-8)} <ExternalLink size={10} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {formatDateTime(d.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Eye size={13} className="text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          {!selected ? (
            <div className="text-center py-10 text-[13px] text-muted-foreground">
              Select a deviation to see details.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14px] font-semibold text-foreground flex-1 min-w-0">
                    {selected.title}
                  </h3>
                  <StatusBadge status={selected.severity} type="severity" />
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  {selected.id} · run {selected.run_id.slice(-8)}
                </p>
              </div>
              {selected.description && (
                <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                  {selected.description}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    State
                  </p>
                  <StatusBadge status={selected.resolution_state} type="resolution" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </p>
                  <p className="text-foreground font-mono">{formatDateTime(selected.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Step</p>
                  <p className="text-foreground font-mono">
                    {selected.step_id ? selected.step_id.slice(-12) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Review
                  </p>
                  <p className="text-foreground">
                    {selected.requires_review ? 'Required' : 'Not required'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/run-detail?id=${selected.run_id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[12px] font-medium text-foreground hover:bg-zinc-700 transition-all"
                >
                  <ExternalLink size={13} /> Open run
                </Link>
                {selected.resolution_state !== 'resolved' && (
                  <button
                    onClick={() => resolve(selected.id)}
                    disabled={resolving === selected.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    {resolving === selected.id ? 'Resolving…' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
