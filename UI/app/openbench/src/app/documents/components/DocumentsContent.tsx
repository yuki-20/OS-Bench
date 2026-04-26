'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Search,
} from 'lucide-react';
import { api, ApiError, type DocumentOut } from '@/lib/api';

const ACCEPT = '.pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain';

function inferType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('sds') || lower.includes('safety')) return 'sds';
  if (lower.includes('manual') || lower.includes('equipment')) return 'manual';
  return 'sop';
}

export default function DocumentsContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const refresh = useCallback(async () => {
    try {
      const list = await api.listDocuments();
      setDocs(list);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const names = list.map((f) => f.name);
    setUploading((u) => [...u, ...names]);
    for (const f of list) {
      try {
        const doc = await api.uploadDocument(f, inferType(f.name));
        toast.success(`Uploaded ${doc.title}`);
      } catch (err) {
        toast.error(
          `Failed to upload ${f.name}: ${err instanceof ApiError ? err.message : (err as Error).message}`
        );
      } finally {
        setUploading((u) => u.filter((n) => n !== f.name));
      }
    }
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api.deleteDocument(id);
      toast.success('Deleted');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  const download = async (id: string) => {
    try {
      const { url } = await api.documentDownloadUrl(id);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  const types = Array.from(new Set(docs.map((d) => d.document_type))).sort();
  const filtered = docs.filter((d) => {
    if (typeFilter && d.document_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.title.toLowerCase().includes(q) && !d.id.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {loading
              ? 'Loading…'
              : `${docs.length} document${docs.length === 1 ? '' : 's'} in your org`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all"
          >
            <RefreshCw size={14} />
          </button>
          <Link
            href="/protocols/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all"
          >
            <Sparkles size={14} /> Compile protocol
          </Link>
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="bg-card border-2 border-dashed border-border rounded-xl px-6 py-10 text-center cursor-pointer hover:border-primary/50 transition-all"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Upload size={32} className="mx-auto text-primary/70 mb-2" />
        <p className="text-[14px] font-semibold text-foreground">Drop files or click to upload</p>
        <p className="text-[12px] text-muted-foreground mt-1">
          PDF, Markdown, plain text · max 25 MB
        </p>
        {uploading.length > 0 && (
          <div className="mt-3 space-y-1">
            {uploading.map((n) => (
              <p
                key={n}
                className="text-[11px] text-primary font-mono flex items-center justify-center gap-2"
              >
                <Loader2 size={11} className="animate-spin" /> {n}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or id…"
            className="w-full bg-zinc-900 border border-border rounded-lg pl-8 pr-4 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[12px] text-muted-foreground">{filtered.length} shown</span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Title
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Pages
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Parse
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                ID
              </th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {docs.length === 0 ? 'No documents yet — upload one above.' : 'No matches.'}
                </td>
              </tr>
            )}
            {filtered.map((d, idx) => (
              <tr
                key={d.id}
                className={`border-b border-border/40 hover:bg-white/[0.03] transition-colors ${
                  idx % 2 === 1 ? 'bg-white/[0.01]' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-muted-foreground" />
                    <span className="text-foreground font-medium truncate max-w-[260px]">
                      {d.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground capitalize">
                  {d.document_type}
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground tabular-nums">
                  {d.page_count}
                </td>
                <td className="px-4 py-3 text-[11px]">
                  <span
                    className={`px-1.5 py-0.5 rounded-full font-mono ${
                      d.parse_status === 'parsed'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : d.parse_status === 'failed'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-zinc-500/15 text-zinc-400'
                    }`}
                  >
                    {d.parse_status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {d.id.slice(-12)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => download(d.id)}
                      className="text-muted-foreground hover:text-primary p-1 rounded"
                      title="Download"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="text-muted-foreground hover:text-red-400 p-1 rounded"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
