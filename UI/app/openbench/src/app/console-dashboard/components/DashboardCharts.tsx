'use client';
import React from 'react';
import RunVolumeChart from './RunVolumeChart';
import DeviationTrendChart from './DeviationTrendChart';

export default function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6">
      <RunVolumeChart />
      <DeviationTrendChart />
    </div>
  );
}
