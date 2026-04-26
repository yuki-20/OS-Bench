import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProtocolReviewContent from '../../components/ProtocolReviewContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProtocolReviewPage({ params }: Props) {
  const { id } = await params;

  return (
    <AppLayout currentPath="/protocols">
      <ProtocolReviewContent draftId={id} />
    </AppLayout>
  );
}
