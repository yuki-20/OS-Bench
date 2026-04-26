'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, tokenStore } from './api';

export interface LiveEvent {
  type: string;
  data: Record<string, unknown>;
  receivedAt: number;
}

export interface UseLiveStreamOptions {
  // Optional event types to listen for. If omitted, every event is reported.
  events?: string[];
  // Called for every received event.
  onEvent?: (event: LiveEvent) => void;
  // Disable connecting (e.g. before auth is ready).
  enabled?: boolean;
}

export function useLiveStream({ events, onEvent, enabled = true }: UseLiveStreamOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    const token = tokenStore.getAccess();
    const orgId = tokenStore.getOrgId();
    if (!token) return;

    const url = new URL(`${API_BASE_URL}/api/notifications/stream`);
    url.searchParams.set('token', token);
    if (orgId) url.searchParams.set('org_id', orgId);

    const es = new EventSource(url.toString());
    let cancelled = false;

    const handleEvent = (eventName: string) => (ev: MessageEvent) => {
      if (cancelled) return;
      let data: Record<string, unknown> = {};
      try {
        data = ev.data ? (JSON.parse(ev.data) as Record<string, unknown>) : {};
      } catch {
        data = {};
      }
      const live: LiveEvent = { type: eventName, data, receivedAt: Date.now() };
      setLastEvent(live);
      onEventRef.current?.(live);
    };

    es.addEventListener('open', () => setConnected(true));
    es.addEventListener('error', () => setConnected(false));
    es.addEventListener('ready', handleEvent('ready'));

    const subscribed =
      events && events.length > 0
        ? events
        : [
            'run_created',
            'run_started',
            'run_state_changed',
            'run_paused',
            'run_resumed',
            'run_cancelled',
            'run_completed',
            'step_started',
            'step_completed',
            'block_triggered',
            'deviation_added',
            'deviation_recorded',
            'escalation_raised',
            'override_requested',
            'override_resolved',
            'message',
          ];
    for (const name of subscribed) {
      es.addEventListener(name, handleEvent(name));
    }

    return () => {
      cancelled = true;
      es.close();
      setConnected(false);
    };
  }, [enabled, events ? events.join(',') : '']);

  return { connected, lastEvent };
}
