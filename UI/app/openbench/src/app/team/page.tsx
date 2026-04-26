import React from 'react';
import AppLayout from '@/components/AppLayout';
import TeamContent from './components/TeamContent';

export default function TeamPage() {
  return (
    <AppLayout currentPath="/team">
      <TeamContent />
    </AppLayout>
  );
}
