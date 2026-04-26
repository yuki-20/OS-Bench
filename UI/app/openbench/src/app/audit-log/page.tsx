import React from 'react';
import AppLayout from '@/components/AppLayout';
import AuditLogContent from './components/AuditLogContent';

export default function AuditLogPage() {
  return (
    <AppLayout currentPath="/audit-log">
      <AuditLogContent />
    </AppLayout>
  );
}
