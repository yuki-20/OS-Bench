import React from 'react';
import AppLayout from '@/components/AppLayout';
import RunMonitorContent from './components/RunMonitorContent';

export default function RunMonitorPage() {
  return (
    <AppLayout currentPath="/run-monitor">
      <RunMonitorContent />
    </AppLayout>
  );
}
