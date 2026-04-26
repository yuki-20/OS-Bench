'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  Download,
  AlertTriangle,
  X,
  SlidersHorizontal,
  Search,
  RefreshCw,
} from 'lucide-react';
import { api, ApiError, API_BASE_URL, tokenStore, type RunOut } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

type SortKey = 'id' | 'protocol_version_id' | 'operator_id' | 'status' | 'started_at';
type SortDir = 'asc' | 'desc';

const STATUS_FILTER_OPTIONS = [
  'created',
  'preflight',
  'active',
  'paused',
  'blocked',
  'awaiting_override',
  'awaiting_handover',
  'completed',
  'cancelled',
  'closed',
];

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}

function durationFromStart(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined
) {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
  return `${m}m`;
}

export default function RunMonitorContent() {
  const [runs, setRuns] = useState<RunOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const perPage = 12;

  const refresh = useCallback(async () => {
    try {
      const res = await api.listRuns();
      setRuns(res);
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
      if (ev.type.startsWith('run_') || ev.type.startsWith('step_')) refresh();
    },
  });

  const sortedFiltered = useMemo(() => {
    let data = [...runs];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.operator_id.toLowerCase().includes(q) ||
          r.protocol_version_id.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
      );
    }
    if (statusFilters.length > 0) data = data.filter((r) => statusFilters.includes(r.status));

    data.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      const aStr = av == null ? '' : typeof av === 'string' ? av.toLowerCase() : String(av);
      const bStr = bv == null ? '' : typeof bv === 'string' ? bv.toLowerCase() : String(bv);
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [runs, search, statusFilters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / perPage));
  const pageData = sortedFiltered.slice((page - 1) * perPage, page * perPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={11} className="text-muted-foreground/50" />;
    return sortDir === 'asc' ? (
      <ChevronUp size={11} className="text-primary" />
    ) : (
      <ChevronDown size={11} className="text-primary" />
    );
  };

  const cols: { key: SortKey; label: string }[] = [
    { key: 'id', label: 'Run ID' },
    { key: 'protocol_version_id', label: 'Protocol' },
    { key: 'operator_id', label: 'Operator' },
    { key: 'status', label: 'Status' },
  ];

  const exportCsv = async () => {
    const token = tokenStore.getAccess();
    const orgId = tokenStore.getOrgId();
    if (!token) {
      toast.error('Not signed in');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/exports/runs.csv`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(orgId ? { 'X-Org-Id': orgId } : {}),
        },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `runs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Run log CSV downloaded');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Run Monitor</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {loading
              ? 'Loading runs…'
              : `${sortedFiltered.length} run${sortedFiltered.length === 1 ? '' : 's'} — live`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all active:scale-95"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all active:scale-95"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search run ID, operator ID, status…"
            className="w-full bg-zinc-900 border border-border rounded-lg pl-8 pr-4 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowStatusFilter((s) => !s)}
            className="flex items-center gap-1.5 bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground hover:border-primary/50 transition-colors"
          >
            <SlidersHorizontal size={12} />
            Status
            {statusFilters.length > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] font-semibold px-1.5 rounded-full">
                {statusFilters.length}
              </span>
            )}
          </button>
          {showStatusFilter && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-border rounded-xl shadow-xl z-20 py-1.5 min-w-[200px] animate-fade-in">
              {STATUS_FILTER_OPTIONS.map((s) => (
                <label
                  key={`sf-${s}`}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer hover:bg-white/5 capitalize"
                >
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(s)}
                    onChange={() => {
                      setStatusFilters((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      );
                      setPage(1);
                    }}
                    className="accent-primary"
                  />
                  {s.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          )}
        </div>

        {(search || statusFilters.length > 0) && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilters([]);
              setPage(1);
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                {cols.map((c) => (
                  <th key={`th-${c.key}`} className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort(c.key)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {c.label}
                      <SortIcon col={c.key} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  <button
                    onClick={() => handleSort('started_at')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Started <SortIcon col="started_at" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Block reason
                </th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {!loading && pageData.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-muted-foreground text-[13px]"
                  >
                    {runs.length === 0
                      ? 'No runs yet. Start one from the operator app to see it here.'
                      : 'No runs match these filters.'}
                  </td>
                </tr>
              )}
              {pageData.map((run, idx) => (
                <tr
                  key={run.id}
                  className={`border-b border-border/40 transition-colors hover:bg-white/[0.03] group ${
                    idx % 2 === 1 ? 'bg-white/[0.01]' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-[12px] text-primary whitespace-nowrap">
                    <Link href={`/run-detail?id=${run.id}`} className="hover:underline">
                      {run.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {run.protocol_version_id.slice(-12)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                    {run.operator_id.slice(-8)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={run.status} type="run" />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                    {formatTime(run.started_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                    {durationFromStart(run.started_at, run.ended_at)}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground max-w-[200px] truncate">
                    {run.block_reason ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle size={11} /> {run.block_reason}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/run-detail?id=${run.id}`}
                        title="View run detail"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                      >
                        <Eye size={13} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedFiltered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
            <span className="text-[12px] text-muted-foreground">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, sortedFiltered.length)}{' '}
              of {sortedFiltered.length} runs
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={`page-${p}`}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-[12px] font-medium transition-all ${
                    page === p
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
