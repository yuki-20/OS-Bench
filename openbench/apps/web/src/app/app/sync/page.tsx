"use client";

import { useEffect, useState } from "react";

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Banner } from "@/components/ui";
import { flush, listPending, type QueuedEvent } from "@/lib/offline";

export default function SyncPage() {
  const [items, setItems] = useState<QueuedEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ accepted: number; rejected: number } | null>(null);

  async function refresh() {
    setItems(await listPending());
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function flushNow() {
    setBusy(true);
    try {
      const res = await flush();
      setLast(res);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Sync</h1>
        <p className="text-sm text-ink-500">Offline event queue for the bench client.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Pending events ({items.length})</CardTitle></CardHeader>
        <CardBody>
          {last && (
            <Banner tone={last.rejected ? "warn" : "ok"}>
              Last flush: {last.accepted} accepted, {last.rejected} rejected.
            </Banner>
          )}
          {items.length === 0 ? (
            <p className="text-sm text-ink-500">All events synced.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between border-b border-ink-100 py-1">
                  <span><code className="text-xs">{i.event_type}</code> · {i.run_id}</span>
                  <Badge>{i.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Button onClick={flushNow} disabled={busy}>
              {busy ? "Flushing…" : "Flush now"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
