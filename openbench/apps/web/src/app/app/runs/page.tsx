"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { runs } from "@/lib/api";
import { Badge, Card, CardBody, EmptyState, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function ActiveRunsPage() {
  const list = useQuery({ queryKey: ["my-runs"], queryFn: () => runs.list() });
  const active = list.data?.filter((r) => r.status !== "completed" && r.status !== "cancelled");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Active runs</h1>
      {list.isLoading ? <Spinner /> : null}
      {active && active.length > 0 ? (
        <div className="space-y-2">
          {active.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <Link href={`/app/runs/${r.id}`} className="flex items-center justify-between bench-target">
                  <div>
                    <code className="text-xs">{r.id}</code>
                    <div className="text-xs text-ink-500">started {formatRelative(r.started_at)}</div>
                  </div>
                  <Badge variant={r.status === "blocked" ? "warn" : "brand"}>{r.status}</Badge>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No active runs" />
      )}
    </div>
  );
}
