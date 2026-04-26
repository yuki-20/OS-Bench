'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Trash2,
  Sparkles,
  Loader2,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';
import { api, ApiError, type DocumentOut } from '@/lib/api';

const ACCEPT = '.pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain';

function inferType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('sds') || lower.includes('safety')) return 'sds';
  if (lower.includes('manual') || lower.includes('equipment')) return 'manual';
  return 'sop';
}

export default function ProtocolUploadContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState<string[]>([]);
  const [compiling, setCompiling] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const refreshDocs = useCallback(async () => {
    try {
      const list = await api.listDocuments();
      setDocs(list);
    } catch (err) {
      toast.error(`Failed to list documents: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, []);

  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const names = list.map((f) => f.name);
    setUploading((u) => [...u, ...names]);
    const newlyUploadedIds: string[] = [];
    for (const f of list) {
      try {
        const guess = inferType(f.name);
        const doc = await api.uploadDocument(f, guess);
        newlyUploadedIds.push(doc.id);
        toast.success(
          `Uploaded ${f.name} (${doc.page_count ?? 0} pages, ${doc.chunk_count ?? 0} chunks)`
        );
      } catch (err) {
        toast.error(
          `Failed to upload ${f.name}: ${err instanceof ApiError ? err.message : (err as Error).message}`
        );
      } finally {
        setUploading((u) => u.filter((n) => n !== f.name));
      }
    }
    if (newlyUploadedIds.length > 0) {
      await refreshDocs();
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        newlyUploadedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const compile = async () => {
    if (selectedDocIds.size === 0) {
      toast.error('Select at least one document to compile from.');
      return;
    }
    setCompiling(true);
    try {
      const draft = await api.compileProtocolDraft({
        document_ids: Array.from(selectedDocIds),
        name: name.trim() || undefined,
      });
      toast.success(`Compiled ${draft.steps.length} steps — opening review`);
      router.push(`/protocols/${draft.id}/review`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      if (msg?.toLowerCase().includes('api key') || msg?.toLowerCase().includes('anthropic')) {
        toast.error('AI compile failed — set your Anthropic key on the API Keys page first.');
      } else {
        toast.error(`Compile failed: ${msg}`);
      }
    } finally {
      setCompiling(false);
    }
  };

  const removeDoc = async (id: string) => {
    if (!confirm('Delete this document? Any draft compiled from it will lose its source.')) return;
    try {
      await api.deleteDocument(id);
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await refreshDocs();
      toast.success('Document deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link
          href="/protocols"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft size={13} /> Protocols
        </Link>
        <span>/</span>
        <span>New protocol</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Compile a new protocol</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Upload SOPs, SDSs, or equipment manuals. The AI compiles them into a versioned execution
          graph with steps, hazards, controls, and citations.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`bg-card border-2 border-dashed rounded-xl px-6 py-12 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-white/[0.02]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Upload size={36} className="mx-auto text-primary/70 mb-3" />
        <p className="text-[14px] font-semibold text-foreground">
          Drop files here, or click to browse
        </p>
        <p className="text-[12px] text-muted-foreground mt-1">
          PDF, Markdown, or plain text · max 25 MB per file
        </p>
        {uploading.length > 0 && (
          <div className="mt-4 space-y-1">
            {uploading.map((n) => (
              <p
                key={n}
                className="text-[12px] text-primary font-mono flex items-center justify-center gap-2"
              >
                <Loader2 size={12} className="animate-spin" /> uploading {n}…
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Source documents</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {docs.length === 0
                ? 'No documents yet — upload one above.'
                : `${docs.length} in your org · ${selectedDocIds.size} selected for compile`}
            </p>
          </div>
          <button
            onClick={refreshDocs}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        </div>
        {docs.length > 0 && (
          <div className="divide-y divide-border max-h-80 overflow-y-auto scrollbar-thin">
            {docs.map((d) => {
              const checked = selectedDocIds.has(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                    checked ? 'bg-primary/5' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDoc(d.id)}
                    className="accent-primary"
                  />
                  <FileText size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {d.document_type} · {d.page_count} pages · {d.parse_status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      removeDoc(d.id);
                    }}
                    className="text-muted-foreground hover:text-red-400 p-1 rounded"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Compile</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Calls Anthropic. Takes 30–90 seconds depending on document size.
          </p>
        </div>
        <label className="block">
          <span className="block text-[12px] font-medium text-foreground mb-1.5">
            Protocol name (optional — AI infers if blank)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Buffer Exchange SOP"
            className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </label>

        {selectedDocIds.size === 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300 flex items-center gap-2">
            <AlertTriangle size={13} /> Select at least one source document.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Link
            href="/protocols"
            className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={compile}
            disabled={compiling || selectedDocIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {compiling ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Compiling…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Compile draft
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
