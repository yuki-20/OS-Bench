'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { api, ApiError, type ApiKeyStatus, type ApiKeyTestResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const PROVIDER_NAME = 'Anthropic Claude';
const KEY_HELP_URL = 'https://console.anthropic.com/settings/keys';

export default function ApiKeysContent() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [draft, setDraft] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ApiKeyTestResponse | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isManagerOrAbove =
    user?.role === 'admin' || user?.role === 'manager' || user?.role === 'safety_lead';

  const refresh = useCallback(async () => {
    try {
      const res = await api.getApiKeyStatus();
      setStatus(res);
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error('Paste a key first');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      toast.error('Anthropic keys start with sk-ant-…');
      return;
    }
    setSaving(true);
    try {
      const next = await api.updateApiKey(trimmed);
      setStatus(next);
      setDraft('');
      setShowDraft(false);
      setTestResult(null);
      toast.success('API key saved. Live AI features now use your key.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      const next = await api.updateApiKey(null);
      setStatus(next);
      setTestResult(null);
      setConfirmingClear(false);
      toast.success(
        next.source === 'env'
          ? 'Org key cleared. Falling back to the server-configured key.'
          : 'Org key cleared. AI features will be unavailable until a new key is set.'
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testApiKey();
      setTestResult(res);
      if (res.ok) toast.success('Connection OK');
      else toast.error('Connection failed');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setTestResult({ ok: false, detail: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  if (permissionDenied) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
        <div className="bg-card border border-amber-500/30 rounded-xl p-6 flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-medium">Manager role required</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Sign in as a manager or admin to view or edit API keys.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Bring your own {PROVIDER_NAME} key. Required for protocol compilation, photo verification,
          and the Ask AI assistant during runs.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">{PROVIDER_NAME}</h2>
        </div>

        {loading ? (
          <div className="text-[13px] text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-zinc-950 px-4 py-3 flex items-center gap-3">
              {status?.has_key ? (
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert size={16} className="text-amber-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground">
                  {status?.has_key
                    ? status.source === 'org'
                      ? 'Your organization has its own key configured.'
                      : 'Falling back to the server-configured key.'
                    : 'No key configured. AI features will fail until one is added.'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                  {status?.masked ? status.masked : 'sk-ant-…'}
                  {status?.source === 'env' && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider">(server env)</span>
                  )}
                  {status?.source === 'org' && status.updated_at && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider">
                      updated {new Date(status.updated_at).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              {status?.has_key && (
                <button
                  onClick={test}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-border rounded-lg text-[12px] font-medium text-foreground hover:bg-zinc-700 transition-all disabled:opacity-50"
                >
                  <Zap size={13} />
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
              )}
            </div>

            {testResult && (
              <div
                className={`rounded-lg border px-3 py-2 text-[12px] ${
                  testResult.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}
              >
                <p className="font-medium">
                  {testResult.ok ? 'Connection OK' : 'Connection failed'}
                </p>
                {testResult.detail && (
                  <p className="font-mono mt-1 opacity-80 break-all">{testResult.detail}</p>
                )}
                {testResult.model && (
                  <p className="text-[11px] mt-1 opacity-70">Model: {testResult.model}</p>
                )}
              </div>
            )}
          </>
        )}

        {isAdmin ? (
          <form onSubmit={save} className="space-y-3 pt-2 border-t border-border">
            <label className="block">
              <span className="block text-[12px] font-medium text-foreground mb-1.5">
                {status?.source === 'org' ? 'Replace key' : 'Add key'}
              </span>
              <div className="relative">
                <Key
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type={showDraft ? 'text' : 'password'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="sk-ant-api03-…"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-zinc-900 border border-border rounded-lg pl-9 pr-10 py-2 text-[13px] text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowDraft((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showDraft ? 'Hide key' : 'Show key'}
                >
                  {showDraft ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Get a key from{' '}
                <a
                  href={KEY_HELP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.anthropic.com
                </a>
                . The key is stored on the server and only a masked preview is ever returned.
              </p>
            </label>
            <div className="flex items-center justify-between gap-2">
              <div>
                {status?.source === 'org' &&
                  (confirmingClear ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-amber-400">Clear org key?</span>
                      <button
                        type="button"
                        onClick={clear}
                        disabled={saving}
                        className="px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Yes, clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingClear(false)}
                        className="px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} /> Clear org key
                    </button>
                  ))}
              </div>
              <button
                type="submit"
                disabled={saving || !draft.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save key'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[12px] text-muted-foreground border-t border-border pt-3">
            {isManagerOrAbove
              ? 'Admin role required to add or change the org key.'
              : 'Manager or admin role required to add or change the org key.'}
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-2">
        <h3 className="text-[13px] font-semibold text-foreground">Where this key is used</h3>
        <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc list-inside">
          <li>
            <span className="text-foreground">Protocol compilation</span> — turning uploaded SOPs
            and SDSs into versioned execution graphs.
          </li>
          <li>
            <span className="text-foreground">Photo verification</span> — running visual checkpoints
            during a run.
          </li>
          <li>
            <span className="text-foreground">Ask AI</span> — operator Q&A inside an active run.
          </li>
          <li>
            <span className="text-foreground">Safety review</span> — the deviation triage assistant.
          </li>
          <li>
            <span className="text-foreground">Handover report</span> — generating the post-run
            summary.
          </li>
        </ul>
      </div>
    </div>
  );
}
