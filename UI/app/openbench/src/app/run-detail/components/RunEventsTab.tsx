'use client';
import React, { useMemo, useState } from 'react';
import { Search, Activity } from 'lucide-react';
import { useRunDetail } from './RunDetailContext';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function RunEventsTab() {
  const { detail } = useRunDetail();
  const [query, setQuery] = useState('');

  const events = useMemo(() => {
    if (!detail) return [];
    const sorted = [...detail.events].sort((a, b) =>
      a.server_timestamp < b.server_timestamp ? 1 : -1
    );
    if (!query) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (e) =>
        e.event_type.toLowerCase().includes(q) ||
        (e.step_id ?? '').toLowerCase().includes(q) ||
        (e.actor_id ?? '').toLowerCase().includes(q) ||
        JSON.stringify(e.payload_json ?? '')
          .toLowerCase()
          .includes(q)
    );
  }, [detail, query]);

  if (!detail) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[13px] font-semibold text-foreground">Event Timeline</h4>
        <div className="relative w-64">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter events…"
            className="w-full bg-zinc-900 border border-border rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>
      {events.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-muted-foreground flex flex-col items-center gap-2">
          <Activity size={24} className="text-muted-foreground/50" />
          {query ? 'No events match your filter.' : 'No events recorded yet.'}
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border max-h-[480px] overflow-y-auto scrollbar-thin">
          {events.map((event) => (
            <div
              key={event.id}
              className="px-4 py-2.5 flex items-start gap-3 hover:bg-white/[0.02]"
            >
              <span className="font-mono text-[11px] text-muted-foreground w-20 shrink-0 mt-0.5">
                {formatTime(event.server_timestamp)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground capitalize">
                  {event.event_type.replace(/_/g, ' ')}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                  {event.actor_id && <span>actor {event.actor_id.slice(-8)}</span>}
                  {event.step_id && <span>step {event.step_id.slice(-8)}</span>}
                </div>
                {event.payload_json && Object.keys(event.payload_json).length > 0 && (
                  <pre className="mt-2 text-[11px] font-mono text-muted-foreground bg-zinc-950 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(event.payload_json, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
