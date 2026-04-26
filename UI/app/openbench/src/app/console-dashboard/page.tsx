'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardKPIs from './components/DashboardKPIs';
import DashboardCharts from './components/DashboardCharts';
import ActiveRunsTable from './components/ActiveRunsTable';
import AuditTimeline from './components/AuditTimeline';
import DashboardFilters from './components/DashboardFilters';
import { useLiveStream } from '@/lib/sse';

export default function ConsoleDashboardPage() {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { connected, lastEvent } = useLiveStream();

  useEffect(() => {
    if (lastEvent) setLastUpdate(new Date(lastEvent.receivedAt));
  }, [lastEvent]);

  useEffect(() => {
    const t = window.setInterval(() => setLastUpdate(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const stamp = lastUpdate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <AppLayout currentPath="/console-dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Control Console</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Org-wide run oversight — last updated{' '}
              <span className="font-mono text-[12px]">{stamp}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
                connected
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'
                }`}
              />
              {connected ? 'Live feed active' : 'Live feed offline'}
            </span>
          </div>
        </div>

        <DashboardFilters />
        <DashboardKPIs />
        <DashboardCharts />

        <div className="grid grid-cols-1 xl:grid-cols-3 2xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <ActiveRunsTable />
          </div>
          <div className="xl:col-span-1">
            <AuditTimeline />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
