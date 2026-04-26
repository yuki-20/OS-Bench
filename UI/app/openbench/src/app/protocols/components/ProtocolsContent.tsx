'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  Search,
  Plus,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  Edit3,
  RefreshCw,
  PlayCircle,
  Loader2,
} from 'lucide-react';
import { api, ApiError, type ProtocolOut, type ProtocolVersionOut } from '@/lib/api';

interface Row {
  id: string;
  headVersionId: string | null;
  name: string;
  status: string;
  currentVersion: string;
  versionCount: number;
  lastModified: string;
  versions: ProtocolVersionOut[];
}

const STATUS_OPTIONS = ['draft', 'in_review', 'published', 'archived'];
type SortKey = 'name' | 'status' | 'lastModified';
type SortDir = 'asc' | 'desc';

function pickHeadVersion(versions: ProtocolVersionOut[]): ProtocolVersionOut | null {
  if (versions.length === 0) return null;
  const order = { published: 0, in_review: 1, draft: 2, archived: 3 };
  const sorted = [...versions].sort((a, b) => {
    const ao = order[a.status as keyof typeof order] ?? 9;
    const bo = order[b.status as keyof typeof order] ?? 9;
    if (ao !== bo) return ao - bo;
    const aDate = a.published_at || a.created_at || '';
    const bDate = b.published_at || b.created_at || '';
    return aDate < bDate ? 1 : -1;
  });
  return sorted[0];
}

export default function ProtocolsContent() {
  const router = useRouter();
  const [protocols, setProtocols] = useState<ProtocolOut[]>([]);
  const [versions, setVersions] = useState<ProtocolVersionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastModified');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const startRunFor = async (versionId: string) => {
    setStartingId(versionId);
    try {
      const run = await api.createRun({ protocol_version_id: versionId });
      toast.success(`Run ${run.id} created`);
      router.push(`/run-detail?id=${run.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setStartingId(null);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const [protos, vers] = await Promise.all([api.listProtocols(), api.listProtocolVersions()]);
      setProtocols(protos);
      setVersions(vers);
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

  const rows = useMemo<Row[]>(() => {
    const versionByProto = new Map<string, ProtocolVersionOut[]>();
    for (const v of versions) {
      const list = versionByProto.get(v.protocol_id) ?? [];
      list.push(v);
      versionByProto.set(v.protocol_id, list);
    }
    return protocols.map((p) => {
      const vs = versionByProto.get(p.id) ?? [];
      const head = pickHeadVersion(vs);
      const lastModified = head?.published_at || head?.created_at || p.created_at || '';
      return {
        id: p.id,
        headVersionId: head?.id ?? null,
        name: p.name,
        status: head?.status || 'draft',
        currentVersion: head?.version_label || '—',
        versionCount: vs.length,
        lastModified,
        versions: vs,
      };
    });
  }, [protocols, versions]);

  const filtered = useMemo(() => {
    let data = [...rows];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.currentVersion.toLowerCase().includes(q)
      );
    }
    if (statusFilter) data = data.filter((r) => r.status === statusFilter);
    data.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const aStr = av == null ? '' : typeof av === 'string' ? av.toLowerCase() : String(av);
      const bStr = bv == null ? '' : typeof bv === 'string' ? bv.toLowerCase() : String(bv);
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [rows, search, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Protocols</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {loading
              ? 'Loading protocols…'
              : `${rows.length} protocol${rows.length === 1 ? '' : 's'} — ${versions.length} version${
                  versions.length === 1 ? '' : 's'
                } total`}
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
          <Link
            href="/protocols/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={14} /> New protocol
          </Link>
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
            placeholder="Search protocols…"
            className="w-full bg-zinc-900 border border-border rounded-lg pl-8 pr-4 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        {(search || statusFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground">
          {filtered.length} protocols
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Protocol <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Status <SortIcon col="status" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Head Version
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Versions
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('lastModified')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Last Modified <SortIcon col="lastModified" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((proto, idx) => (
                <tr
                  key={proto.id}
                  className={`border-b border-border/40 hover:bg-white/[0.03] transition-colors ${
                    idx % 2 === 1 ? 'bg-white/[0.01]' : ''
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{proto.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {proto.id.slice(-12)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={proto.status} type="protocol" />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {proto.currentVersion}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[12px] text-muted-foreground tabular-nums">
                      {proto.versionCount}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[12px] text-muted-foreground font-mono">
                      {proto.lastModified
                        ? new Date(proto.lastModified).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      {proto.status === 'draft' || proto.status === 'in_review' ? (
                        proto.headVersionId ? (
                          <Link
                            href={`/protocols/${proto.headVersionId}/review`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                          >
                            <Edit3 size={12} /> Review
                          </Link>
                        ) : null
                      ) : proto.headVersionId ? (
                        <>
                          <Link
                            href={`/protocols/${proto.headVersionId}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                          >
                            <Eye size={12} /> View
                          </Link>
                          {proto.status === 'published' && (
                            <button
                              onClick={() => startRunFor(proto.headVersionId!)}
                              disabled={startingId === proto.headVersionId}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                            >
                              {startingId === proto.headVersionId ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <PlayCircle size={12} />
                              )}
                              Start run
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-muted-foreground text-[13px]"
                  >
                    {rows.length === 0
                      ? 'No protocols yet. Compile your first one from a source document.'
                      : 'No protocols match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
