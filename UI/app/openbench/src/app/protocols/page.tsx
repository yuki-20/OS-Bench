import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProtocolsContent from './components/ProtocolsContent';

export default function ProtocolsPage() {
  return (
    <AppLayout currentPath="/protocols">
      <ProtocolsContent />
    </AppLayout>
  );
}
