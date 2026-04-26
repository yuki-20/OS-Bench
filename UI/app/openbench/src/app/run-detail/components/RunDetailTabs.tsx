'use client';
import React, { useMemo, useState } from 'react';
import RunOverviewTab from './RunOverviewTab';
import RunActionsTab from './RunActionsTab';
import RunEventsTab from './RunEventsTab';
import RunDeviationsTab from './RunDeviationsTab';
import RunPhotosTab from './RunPhotosTab';
import RunHandoverTab from './RunHandoverTab';
import { useRunDetail } from './RunDetailContext';

export default function RunDetailTabs() {
  const [activeTab, setActiveTab] = useState('overview');
  const { detail } = useRunDetail();

  const tabs = useMemo(() => {
    const eventsCount = detail?.events.length ?? 0;
    const openDevs = detail?.deviations.filter((d) => d.resolution_state === 'open').length ?? 0;
    const photosCount = detail?.attachments.filter((a) => a.kind?.includes('photo')).length ?? 0;
    return [
      {
        id: 'overview',
        label: 'Overview' as const,
        badge: undefined as number | undefined,
        alert: false,
      },
      { id: 'actions', label: 'Operator', badge: undefined, alert: false },
      { id: 'events', label: 'Events', badge: eventsCount, alert: false },
      { id: 'deviations', label: 'Deviations', badge: openDevs, alert: openDevs > 0 },
      { id: 'photos', label: 'Photos', badge: photosCount, alert: false },
      { id: 'handover', label: 'Handover', badge: undefined, alert: false },
    ];
  }, [detail]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center border-b border-border px-5 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all
              ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  tab.alert ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="p-5">
        {activeTab === 'overview' && <RunOverviewTab />}
        {activeTab === 'actions' && <RunActionsTab />}
        {activeTab === 'events' && <RunEventsTab />}
        {activeTab === 'deviations' && <RunDeviationsTab />}
        {activeTab === 'photos' && <RunPhotosTab />}
        {activeTab === 'handover' && <RunHandoverTab />}
      </div>
    </div>
  );
}
