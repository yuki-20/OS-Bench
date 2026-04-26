'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  api,
  ApiError,
  type ProtocolStepOut,
  type ProtocolVersionDetail,
  type RunDetail,
} from '@/lib/api';
import { useLiveStream } from '@/lib/sse';

interface RunDetailContextValue {
  runId: string | null;
  detail: RunDetail | null;
  protocol: ProtocolVersionDetail | null;
  stepsById: Map<string, ProtocolStepOut>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<RunDetailContextValue | null>(null);

export function useRunDetail() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRunDetail must be inside RunDetailProvider');
  return v;
}

export function RunDetailProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const runId = params.get('id');
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [protocol, setProtocol] = useState<ProtocolVersionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!runId);

  const refresh = useCallback(async () => {
    if (!runId) {
      setDetail(null);
      setProtocol(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.getRun(runId);
      setDetail(res);
      setError(null);
      // Fetch the protocol version once we know which one this run uses.
      const pvId = res.run.protocol_version_id;
      if (pvId && (!protocol || protocol.id !== pvId)) {
        try {
          const pv = await api.getProtocolVersion(pvId);
          setProtocol(pv);
        } catch {
          // Non-fatal — Overview tab will degrade gracefully.
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [runId, protocol]);

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useLiveStream({
    onEvent: (ev) => {
      if (!runId) return;
      const target = ev.data && (ev.data as Record<string, unknown>).run_id;
      if (!target || target === runId) refresh();
    },
  });

  const stepsById = new Map<string, ProtocolStepOut>((protocol?.steps ?? []).map((s) => [s.id, s]));

  return (
    <Ctx.Provider value={{ runId, detail, protocol, stepsById, loading, error, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
