"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { runs } from "@/lib/api";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function RunsPage() {
  const list = useQuery({ queryKey: ["runs"], queryFn: () => runs.list() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Runs</h1>
        <p className="text-sm text-ink-500">All run records bound to immutable protocol versions.</p>
      </div>
      {list.isLoading ? (
        <div className="text-ink-500"><Spinner /> Loading…</div>
      ) : list.data && list.data.length > 0 ? (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="text-left px-4 py-2">Run</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Operator</th>
                  <th className="text-left px-4 py-2">Started</th>
                  <th className="text-left px-4 py-2">Ended</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((r) => (
                  <tr key={r.id} className="border-t border-ink-200 hover:bg-ink-50">
                    <td className="px-4 py-2"><code className="text-xs">{r.id}</code></td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          r.status === "active"
                            ? "brand"
                            : r.status === "blocked" || r.status === "awaiting_override"
                            ? "warn"
                            : r.status === "completed"
                            ? "ok"
                            : "muted"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-600">{r.operator_id}</td>
                    <td className="px-4 py-2 text-xs">{formatRelative(r.started_at)}</td>
                    <td className="px-4 py-2 text-xs">{formatRelative(r.ended_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/console/runs/${r.id}`} className="text-brand-700 underline text-xs">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : (
        <EmptyState title="No runs yet" description="Runs appear here when operators start them in the Bench Runtime." />
      )}
    </div>
  );
}
