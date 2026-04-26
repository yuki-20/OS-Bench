'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { StoredUser } from '@/lib/api';

const fallbackSession: StoredUser = {
  id: 'pending',
  email: '',
  display_name: 'OpenBench User',
  org_id: '',
  org_name: 'OpenBench',
  org_slug: 'openbench',
  role: 'operator',
  initials: 'OB',
};

// Backwards-compatible adapter so existing call sites that imported
// `useDemoSession` keep working.
export interface DemoSessionLike {
  id: string;
  email: string;
  name: string;
  organization: string;
  role: string;
  initials: string;
  createdAt: string;
}

export function useDemoSession(): DemoSessionLike {
  const { user } = useAuth();
  const u = user || fallbackSession;
  return {
    id: u.id,
    email: u.email,
    name: u.display_name,
    organization: u.org_name,
    role: u.role,
    initials: u.initials,
    createdAt: '',
  };
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && typeof window !== 'undefined') {
      router.replace('/sign-up-login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-[13px] text-muted-foreground">Opening your dashboard...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
