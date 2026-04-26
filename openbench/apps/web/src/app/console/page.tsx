"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { dashboard, escalations } from "@/lib/api";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Spinner, Stat } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function DashboardPage() {
  const stats = useQuery({ queryKey: ["dash"], queryFn: dashboard.stats });
  const recent = useQuery({ queryKey: ["dash-recent"], queryFn: dashboard.recentRuns });
  const openEsc = useQuery({
    queryKey: ["dash-escalations"],
    queryFn: () => escalations.list({ state: "open" }),
    refetchInterval: 12000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-ink-500">Live status of protocols, runs, and reviews.</p>
      </div>

      {stats.isLoading ? (
        <div className="text-ink-500"><Spinner /> Loading…</div>
      ) : stats.data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <Stat label="Active runs" value={stats.data.active_runs} />
          <Stat label="Blocked" value={stats.data.blocked_runs} tone={stats.data.blocked_runs ? "warn" : "default"} />
          <Stat label="Drafts in review" value={stats.data.drafts_in_review} />
          <Stat
            label="Open deviations"
            value={stats.data.deviations_open}
            tone={stats.data.deviations_open ? "danger" : "default"}
          />
          <Stat
            label="Open escalations"
            value={openEsc.data?.length ?? "—"}
            tone={(openEsc.data?.length || 0) > 0 ? "warn" : "default"}
          />
          <Stat label="Completed (7d)" value={stats.data.completed_runs_7d} />
          <Stat label="Pending handovers" value={stats.data.pending_handovers} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {recent.isLoading ? (
            <div className="p-6 text-ink-500"><Spinner /> Loading…</div>
          ) : recent.data && recent.data.length > 0 ? (
            <div className="divide-y divide-ink-200">
              {recent.data.map((r) => (
                <Link
                  key={r.id}
                  href={`/console/runs/${r.id}`}
                  className="grid grid-cols-12 gap-3 px-4 py-3 text-sm hover:bg-ink-50 items-center"
                >
                  <code className="col-span-3 text-xs text-ink-700">{r.id}</code>
                  <div className="col-span-2">
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
                  </div>
                  <div className="col-span-3 truncate text-ink-700">
                    {r.protocol_version_id}
                  </div>
                  <div className="col-span-2 text-ink-500 text-xs">{r.operator_id}</div>
                  <div className="col-span-2 text-right text-ink-500 text-xs">
                    {r.started_at ? formatRelative(r.started_at) : "not started"}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No runs yet"
                description="Reviewers can compile and publish protocols; operators start runs from the bench client."
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
