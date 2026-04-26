import React from 'react';
import AppLayout from '@/components/AppLayout';
import ApiKeysContent from './components/ApiKeysContent';

export default function ApiKeysPage() {
  return (
    <AppLayout currentPath="/api-keys">
      <ApiKeysContent />
    </AppLayout>
  );
}
