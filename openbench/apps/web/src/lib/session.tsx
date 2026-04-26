"use client";

import { create } from "zustand";
import type { Me } from "@openbench/schemas";

import { auth as authApi, clearAuth, getStoredToken, setAuth, setOrgId } from "@/lib/api";

type State = {
  ready: boolean;
  user: Me | null;
  activeOrgId: string | null;
  load: () => Promise<void>;
  login: (email: string, password: string) => Promise<Me>;
  register: (input: {
    email: string;
    password: string;
    display_name: string;
    org_name: string;
  }) => Promise<Me>;
  signOut: () => void;
  setActiveOrg: (id: string) => void;
  hasRole: (role: string) => boolean;
};

const ROLE_RANK: Record<string, number> = {
  operator: 0,
  reviewer: 2,
  manager: 3,
  safety_lead: 3,
  admin: 4,
};

export const useSession = create<State>((set, get) => ({
  ready: false,
  user: null,
  activeOrgId: null,
  load: async () => {
    if (typeof window === "undefined") return;
    const tok = getStoredToken();
    if (!tok) {
      set({ ready: true, user: null });
      return;
    }
    try {
      const me = await authApi.me();
      const stored = window.localStorage.getItem("openbench.orgId");
      const org = stored && me.memberships.find((m) => m.org_id === stored)
        ? stored
        : me.memberships[0]?.org_id ?? null;
      if (org) setOrgId(org);
      set({ ready: true, user: me, activeOrgId: org });
    } catch {
      clearAuth();
      set({ ready: true, user: null, activeOrgId: null });
    }
  },
  login: async (email, password) => {
    const tok = await authApi.login(email, password);
    setAuth(tok);
    const me = await authApi.me();
    const org = me.memberships[0]?.org_id || null;
    if (org) setOrgId(org);
    set({ user: me, activeOrgId: org, ready: true });
    return me;
  },
  register: async (data) => {
    const tok = await authApi.register({ ...data });
    setAuth(tok);
    const me = await authApi.me();
    const org = me.memberships[0]?.org_id || null;
    if (org) setOrgId(org);
    set({ user: me, activeOrgId: org, ready: true });
    return me;
  },
  signOut: () => {
    // Best-effort server-side revocation (refresh-token jti). We don't await it
    // so signOut stays instantaneous from the user's perspective.
    void authApi.logout().catch(() => undefined);
    clearAuth();
    set({ user: null, activeOrgId: null });
  },
  setActiveOrg: (id) => {
    setOrgId(id);
    set({ activeOrgId: id });
  },
  hasRole: (role) => {
    const u = get().user;
    const orgId = get().activeOrgId;
    if (!u || !orgId) return false;
    const m = u.memberships.find((x) => x.org_id === orgId);
    if (!m) return false;
    return (ROLE_RANK[m.role] ?? -1) >= (ROLE_RANK[role] ?? 999);
  },
}));
