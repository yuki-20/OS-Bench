import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProtocolVersionContent from '../../components/ProtocolVersionContent';

interface Props {
  params: { id: string };
}

export default function ProtocolVersionPage({ params }: Props) {
  return (
    <AppLayout currentPath="/protocols">
      <ProtocolVersionContent versionId={params.id} />
    </AppLayout>
  );
}
