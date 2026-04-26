'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Mail, Search, ShieldAlert, X, Send } from 'lucide-react';
import { api, ApiError, type MemberOut } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const ROLES = ['operator', 'reviewer', 'manager', 'safety_lead', 'admin'];

export default function TeamContent() {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    display_name: '',
    role: 'operator',
    initial_password: '',
  });

  const refresh = useCallback(async () => {
    try {
      const res = await api.listMembers();
      setMembers(res);
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

  const filtered = useMemo(() => {
    let data = [...members];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (m) =>
          m.user.email.toLowerCase().includes(q) || m.user.display_name.toLowerCase().includes(q)
      );
    }
    if (roleFilter) data = data.filter((m) => m.role === roleFilter);
    return data;
  }, [members, search, roleFilter]);

  const isAdmin = user?.role === 'admin';

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.display_name || inviteForm.initial_password.length < 6) {
      toast.error('Email, name, and a password ≥ 6 chars are required');
      return;
    }
    setInviting(true);
    try {
      await api.inviteUser(inviteForm);
      toast.success(`Invited ${inviteForm.email} as ${inviteForm.role}`);
      setInviteForm({ email: '', display_name: '', role: 'operator', initial_password: '' });
      setShowInvite(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (m: MemberOut, role: string) => {
    if (role === m.role) return;
    setUpdatingId(m.membership_id);
    try {
      await api.updateMembership(m.membership_id, role);
      toast.success(`Updated ${m.user.email} to ${role}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (permissionDenied) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
        </div>
        <div className="bg-card border border-amber-500/30 rounded-xl p-6 flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-medium">Manager role required</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Sign in as a manager or admin to view org members.
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
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : `${members.length} member${members.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all"
          >
            <UserPlus size={14} /> Invite member
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {showInvite && (
        <form
          onSubmit={submitInvite}
          className="bg-card border border-border rounded-xl p-4 space-y-3"
        >
          <h3 className="text-[13px] font-semibold text-foreground">Invite a new member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="user@lab.org"
              className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px]"
            />
            <input
              required
              value={inviteForm.display_name}
              onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
              placeholder="Full name"
              className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px]"
            />
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px] capitalize"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ')}
                </option>
              ))}
            </select>
            <input
              type="password"
              required
              minLength={6}
              value={inviteForm.initial_password}
              onChange={(e) => setInviteForm({ ...inviteForm, initial_password: e.target.value })}
              placeholder="Initial password (≥ 6 chars)"
              className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <Send size={13} /> {inviting ? 'Inviting…' : 'Send invite'}
            </button>
          </div>
        </form>
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
            placeholder="Search name or email…"
            className="w-full bg-zinc-900 border border-border rounded-lg pl-8 pr-4 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer capitalize"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
        {(search || roleFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setRoleFilter('');
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground">{filtered.length} shown</span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Member
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Email
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Role
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No members found.
                </td>
              </tr>
            )}
            {filtered.map((m, idx) => (
              <tr
                key={m.membership_id}
                className={`border-b border-border/40 hover:bg-white/[0.03] transition-colors ${
                  idx % 2 === 1 ? 'bg-white/[0.01]' : ''
                }`}
              >
                <td className="px-4 py-3 text-foreground font-medium">{m.user.display_name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail size={12} /> {m.user.email}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{m.user.status}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m, e.target.value)}
                      disabled={updatingId === m.membership_id}
                      className="bg-zinc-900 border border-border rounded-lg px-2.5 py-1 text-[12px] text-foreground capitalize cursor-pointer disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-foreground capitalize text-[12px]">
                      {m.role.replace('_', ' ')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
