import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import RunDetailHeader from './components/RunDetailHeader';
import RunDetailTabs from './components/RunDetailTabs';
import { RunDetailProvider } from './components/RunDetailContext';

export default function RunDetailPage() {
  return (
    <AppLayout currentPath="/run-monitor">
      <Suspense fallback={<div className="text-muted-foreground text-[13px]">Loading run…</div>}>
        <RunDetailProvider>
          <div className="space-y-5">
            <RunDetailHeader />
            <RunDetailTabs />
          </div>
        </RunDetailProvider>
      </Suspense>
    </AppLayout>
  );
}
