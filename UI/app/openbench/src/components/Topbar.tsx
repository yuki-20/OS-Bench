'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useDemoSession } from './AuthGate';
import { useLiveStream } from '@/lib/sse';

export default function Topbar() {
  const router = useRouter();
  const session = useDemoSession();
  const { signOut } = useAuth();
  const { connected } = useLiveStream();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-up-login');
  };

  return (
    <header className="h-16 flex items-center gap-4 px-6 border-b border-border bg-zinc-950/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <div className="relative w-full">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search runs, protocols, operators..."
            className="w-full bg-zinc-900 border border-border rounded-lg pl-9 pr-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
          ${connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-muted-foreground'}`}
          title={connected ? 'Server-sent events stream connected' : 'Live stream offline'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
            }`}
          />
          {connected ? 'Live' : 'Offline'}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-95"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>

        <Link
          href="/notifications"
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-95"
        >
          <Bell size={15} />
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-95"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={15} />
        </button>

        <div
          className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors"
          title={`${session.name} - ${session.organization}`}
        >
          <span className="text-[11px] font-semibold text-primary">{session.initials}</span>
        </div>
      </div>
    </header>
  );
}
