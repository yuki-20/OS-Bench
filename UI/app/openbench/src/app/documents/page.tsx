import React from 'react';
import AppLayout from '@/components/AppLayout';
import DocumentsContent from './components/DocumentsContent';

export default function DocumentsPage() {
  return (
    <AppLayout currentPath="/documents">
      <DocumentsContent />
    </AppLayout>
  );
}
