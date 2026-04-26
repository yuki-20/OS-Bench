'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { api, ApiError, API_BASE_URL, tokenStore, type AuditLogOut } from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AuditLogContent() {
  const [events, setEvents] = useState<AuditLogOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await api.listAuditLog(500);
      setEvents(res);
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
    onEvent: () => {
      refresh();
    },
  });

  const actionTypes = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.action))).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let data = [...events];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          (e.summary ?? '').toLowerCase().includes(q) ||
          (e.target_id ?? '').toLowerCase().includes(q) ||
          (e.actor_id ?? '').toLowerCase().includes(q)
      );
    }
    if (actionFilter) data = data.filter((e) => e.action === actionFilter);
    return data;
  }, [events, search, actionFilter]);

  const exportCsv = () => {
    const header = [
      'id',
      'created_at',
      'actor_id',
      'action',
      'target_type',
      'target_id',
      'summary',
    ];
    const rows = filtered.map((e) =>
      header
        .map((k) => {
          const v = (e as unknown as Record<string, unknown>)[k];
          if (v == null) return '';
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(',')
    );
    const csv = `${header.join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit CSV downloaded');
  };

  const exportRunsCsv = async () => {
    const token = tokenStore.getAccess();
    const orgId = tokenStore.getOrgId();
    if (!token) return;
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
      a.download = 'runs.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (permissionDenied) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        </div>
        <div className="bg-card border border-amber-500/30 rounded-xl p-6 flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-medium">Manager role required</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Sign in as a manager or admin to view the org audit log.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `${events.length} events recorded`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={exportRunsCsv}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all"
          >
            <Download size={14} /> Runs CSV
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all"
          >
            <Download size={14} /> Audit CSV
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions, summaries, IDs…"
            className="w-full bg-zinc-900 border border-border rounded-lg pl-8 pr-4 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">All actions</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {(search || actionFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setActionFilter('');
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground">{filtered.length} shown</span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No audit events.
                  </td>
                </tr>
              )}
              {filtered.map((e, idx) => (
                <tr
                  key={e.id}
                  className={`border-b border-border/40 hover:bg-white/[0.03] transition-colors ${
                    idx % 2 === 1 ? 'bg-white/[0.01]' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(e.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {e.actor_id ? e.actor_id.slice(-8) : 'system'}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-foreground">
                    {e.action}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-primary/70">
                    {e.target_type ? `${e.target_type}` : ''}{' '}
                    {e.target_id ? e.target_id.slice(-8) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                    {e.summary ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
