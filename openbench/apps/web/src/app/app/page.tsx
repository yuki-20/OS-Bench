"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { protocols, runs } from "@/lib/api";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Spinner, Stat } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function BenchHome() {
  const myRuns = useQuery({ queryKey: ["my-runs"], queryFn: () => runs.list() });
  const versions = useQuery({ queryKey: ["versions"], queryFn: protocols.listPublished });

  const active = myRuns.data?.filter((r) => r.status === "active" || r.status === "blocked");
  const recent = myRuns.data?.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bench Runtime</h1>
        <p className="text-sm text-ink-500">Welcome. Pick a published protocol or resume an active run.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Active runs" value={active?.length || 0} />
        <Stat label="Published protocols" value={versions.data?.length || 0} />
        <Stat label="Recent runs" value={myRuns.data?.length || 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Active</CardTitle></CardHeader>
          <CardBody className="p-0">
            {myRuns.isLoading ? <div className="p-4"><Spinner /></div> : null}
            {active && active.length > 0 ? (
              <ul className="divide-y divide-ink-200">
                {active.map((r) => (
                  <li key={r.id} className="p-3">
                    <Link href={`/app/runs/${r.id}`} className="flex items-center justify-between">
                      <span><code className="text-xs">{r.id}</code> · started {formatRelative(r.started_at)}</span>
                      <Badge variant={r.status === "blocked" ? "warn" : "brand"}>{r.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState title="No active runs" />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent</CardTitle></CardHeader>
          <CardBody className="p-0">
            {recent && recent.length > 0 ? (
              <ul className="divide-y divide-ink-200">
                {recent.map((r) => (
                  <li key={r.id} className="p-3">
                    <Link href={`/app/runs/${r.id}`} className="flex justify-between">
                      <code className="text-xs">{r.id}</code>
                      <Badge>{r.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState title="No runs yet" />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Published protocols</CardTitle></CardHeader>
        <CardBody className="p-0">
          {versions.isLoading ? <div className="p-4"><Spinner /></div> : null}
          {versions.data && versions.data.length > 0 ? (
            <ul className="divide-y divide-ink-200">
              {versions.data.map((v) => (
                <li key={v.id} className="p-3">
                  <Link href={`/app/protocols/${v.id}`} className="flex justify-between bench-target">
                    <span>
                      <code className="text-xs">{v.id}</code> — {v.summary?.slice(0, 80) || v.version_label}
                    </span>
                    <span className="text-xs text-ink-500">{v.version_label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState
                title="No published protocols"
                description="Compile and publish protocols from the Console to make them runnable here."
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
