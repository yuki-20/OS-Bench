"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deviationsApi } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Select, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function DeviationsPage() {
  const [filter, setFilter] = useState<string>("");
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["devs", filter],
    queryFn: () => deviationsApi.list(filter || undefined),
  });
  const resolve = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      deviationsApi.resolve(id, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devs"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deviations</h1>
          <p className="text-sm text-ink-500">Review and resolve deviations across all runs.</p>
        </div>
        <div className="w-44">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All states</option>
            <option value="open">Open</option>
            <option value="review">In review</option>
            <option value="resolved">Resolved</option>
          </Select>
        </div>
      </div>

      {list.isLoading ? (
        <div className="text-ink-500"><Spinner /> Loading…</div>
      ) : list.data && list.data.length > 0 ? (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="text-left px-4 py-2">When</th>
                  <th className="text-left px-4 py-2">Severity</th>
                  <th className="text-left px-4 py-2">Title</th>
                  <th className="text-left px-4 py-2">Run</th>
                  <th className="text-left px-4 py-2">State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((d) => (
                  <tr key={d.id} className="border-t border-ink-100">
                    <td className="px-4 py-2 text-xs text-ink-500">{formatRelative(d.created_at)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={d.severity === "critical" ? "danger" : d.severity === "high" ? "warn" : "muted"}>
                        {d.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{d.title}</td>
                    <td className="px-4 py-2 text-xs">
                      <Link href={`/console/runs/${d.run_id}`} className="text-brand-700 underline">
                        {d.run_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2"><Badge>{d.resolution_state}</Badge></td>
                    <td className="px-4 py-2 text-right space-x-2">
                      {d.resolution_state !== "resolved" && (
                        <Button size="sm" variant="ok" onClick={() => resolve.mutate({ id: d.id, state: "resolved" })}>
                          Resolve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : (
        <EmptyState title="No deviations" description="Nothing to triage right now." />
      )}
    </div>
  );
}
