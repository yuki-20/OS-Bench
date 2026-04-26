'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore, type StoredUser } from './api';

interface AuthState {
  user: StoredUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<StoredUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<StoredUser | null>;
}

const AuthContext = createContext<AuthState | null>(null);

function deriveInitials(name: string, email: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

// If the page was opened with ?access_token=…&refresh_token=… in the URL —
// e.g. a handoff from the landing page after login — pull them into local
// storage and strip the query string before anything else reads it. Returns
// true when tokens were consumed so the bootstrap can use them right away.
function consumeTokensFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const access = url.searchParams.get('access_token');
  const refresh = url.searchParams.get('refresh_token');
  if (!access || !refresh) return false;
  tokenStore.setTokens(access, refresh);
  url.searchParams.delete('access_token');
  url.searchParams.delete('refresh_token');
  // Drop any stale user blob so /me runs fresh against the new tokens.
  try {
    window.localStorage.removeItem('openbench_user');
    window.localStorage.removeItem('openbench_org_id');
  } catch {
    // ignore
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

async function hydrateUserFromMe(): Promise<StoredUser | null> {
  try {
    const me = await api.me();
    if (!me.memberships || me.memberships.length === 0) return null;
    const desiredOrg = tokenStore.getOrgId();
    const m = me.memberships.find((mem) => mem.org_id === desiredOrg) || me.memberships[0];
    const stored: StoredUser = {
      id: me.id,
      email: me.email,
      display_name: me.display_name,
      org_id: m.org_id,
      org_name: m.org_name,
      org_slug: m.org_slug,
      role: m.role,
      initials: deriveInitials(me.display_name, me.email),
    };
    tokenStore.setUser(stored);
    return stored;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      // Landing-page handoff: tokens come in via URL on the redirect after
      // login/signup. When present we hydrate from the API instead of any
      // stale localStorage user.
      const fromUrl = consumeTokensFromUrl();
      if (fromUrl) {
        const fresh = await hydrateUserFromMe();
        if (!cancelled) {
          setUser(fresh);
          setLoading(false);
        }
        return;
      }
      const stored = tokenStore.getUser();
      if (stored) {
        setUser(stored);
        setLoading(false);
        // Background refresh to keep org/role current.
        const fresh = await hydrateUserFromMe();
        if (!cancelled && fresh) setUser(fresh);
        return;
      }
      const access = tokenStore.getAccess();
      if (!access) {
        setLoading(false);
        return;
      }
      const fresh = await hydrateUserFromMe();
      if (!cancelled) {
        setUser(fresh);
        setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const tokens = await api.login(email, password);
    tokenStore.setTokens(tokens.access_token, tokens.refresh_token);
    const fresh = await hydrateUserFromMe();
    if (!fresh) {
      tokenStore.clear();
      throw new Error('Login succeeded but user has no organization memberships.');
    }
    setUser(fresh);
    return fresh;
  }, []);

  const signOut = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    try {
      await api.logout(refresh ?? undefined);
    } catch {
      // best-effort
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await hydrateUserFromMe();
    setUser(fresh);
    return fresh;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
