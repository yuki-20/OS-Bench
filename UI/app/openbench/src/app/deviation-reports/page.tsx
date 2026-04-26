import React from 'react';
import AppLayout from '@/components/AppLayout';
import DeviationReportsContent from './components/DeviationReportsContent';

export default function DeviationReportsPage() {
  return (
    <AppLayout currentPath="/deviation-reports">
      <DeviationReportsContent />
    </AppLayout>
  );
}
