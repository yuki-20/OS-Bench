"use client";

import { useQuery } from "@tanstack/react-query";

import { admin } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export default function AuditPage() {
  const list = useQuery({ queryKey: ["audit"], queryFn: () => admin.audit(500) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-ink-500">All sensitive actions are logged with actor, target, and metadata.</p>
      </div>
      <Card>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="p-6 text-ink-500"><Spinner /> Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Summary</th>
                </tr>
              </thead>
              <tbody>
                {(list.data || []).map((a: any) => (
                  <tr key={a.id} className="border-t border-ink-100">
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                    <td className="px-3 py-2"><code className="text-xs">{a.action}</code></td>
                    <td className="px-3 py-2 text-xs">
                      {a.target_type}
                      {a.target_id ? ": " : ""}
                      <code>{a.target_id || ""}</code>
                    </td>
                    <td className="px-3 py-2 text-xs">{a.actor_id || "—"}</td>
                    <td className="px-3 py-2 text-xs text-ink-600">{a.summary || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
