'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Settings, Database, ShieldCheck, Save } from 'lucide-react';
import { api, ApiError, type OrgSettingsOut } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

export default function SettingsContent() {
  const { user } = useAuth();
  const [orgSettings, setOrgSettings] = useState<OrgSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    data_region: 'us-east-1',
    retention_policy_days: 365,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await api.getOrgSettings();
      setOrgSettings(res);
      setForm({
        name: res.name,
        data_region: res.data_region ?? 'us-east-1',
        retention_policy_days: res.retention_policy_days ?? 365,
      });
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

  const isAdmin = user?.role === 'admin';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateOrgSettings(form);
      setOrgSettings(res);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Org-wide configuration for {orgSettings?.name ?? 'your organization'}.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground text-[13px]">Loading…</div>
      ) : (
        <form onSubmit={save} className="space-y-5">
          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">Organization profile</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-[12px] text-muted-foreground mb-1">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="block text-[12px] text-muted-foreground mb-1">Slug</span>
                <input
                  value={orgSettings?.slug ?? ''}
                  disabled
                  className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] text-muted-foreground font-mono"
                />
              </label>
              <label className="block">
                <span className="block text-[12px] text-muted-foreground mb-1">Org ID</span>
                <input
                  value={orgSettings?.org_id ?? ''}
                  disabled
                  className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] text-muted-foreground font-mono"
                />
              </label>
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">Data residency</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-[12px] text-muted-foreground mb-1">Region</span>
                <select
                  value={form.data_region}
                  onChange={(e) => setForm({ ...form, data_region: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground disabled:opacity-60"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] text-muted-foreground mb-1">
                  Retention (days)
                </span>
                <input
                  type="number"
                  min={30}
                  max={3650}
                  value={form.retention_policy_days}
                  onChange={(e) =>
                    setForm({ ...form, retention_policy_days: Number(e.target.value) })
                  }
                  disabled={!isAdmin}
                  className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground disabled:opacity-60"
                />
              </label>
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">Your account</h2>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Display name
                </dt>
                <dd className="text-foreground">{user?.display_name}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Email
                </dt>
                <dd className="text-foreground">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">Role</dt>
                <dd className="text-foreground capitalize">{user?.role.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">Org</dt>
                <dd className="text-foreground">{user?.org_name}</dd>
              </div>
            </dl>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!isAdmin || saving}
              title={!isAdmin ? 'Admin role required to change settings' : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
