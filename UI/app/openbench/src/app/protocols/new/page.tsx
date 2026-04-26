import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProtocolUploadContent from './components/ProtocolUploadContent';

export default function ProtocolUploadPage() {
  return (
    <AppLayout currentPath="/protocols">
      <ProtocolUploadContent />
    </AppLayout>
  );
}
