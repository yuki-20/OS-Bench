"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { escalations, Escalation } from "@/lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { useSession } from "@/lib/session";

const KIND_LABELS: Record<string, string> = {
  source_conflict: "Source conflict",
  missing_source: "Missing source",
  visual_mismatch: "Visual mismatch",
  unauthorized_substitution: "Unauthorized substitution",
  hazard_condition: "Hazard condition",
  exposure_or_incident: "Exposure / incident",
  model_unsupported: "Model unsupported",
  manual: "Manual",
};

export default function EscalationsConsolePage() {
  const qc = useQueryClient();
  const [stateFilter, setStateFilter] = useState<string>("open");
  const [kindFilter, setKindFilter] = useState<string>("");
  const list = useQuery({
    queryKey: ["escalations-console", stateFilter, kindFilter],
    queryFn: () =>
      escalations.list({
        state: stateFilter || undefined,
        kind: kindFilter || undefined,
      }),
    refetchInterval: 8000,
  });
  const { hasRole } = useSession();
  const canResolve = hasRole("manager") || hasRole("safety_lead") || hasRole("reviewer");
  const resolveM = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "resolved" | "dismissed" }) =>
      escalations.resolve(id, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escalations-console"] }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Escalations</h1>
        <p className="text-sm text-ink-500">
          PRD §17.5 — escalations are routed to specific roles and tracked here. Most are auto-triggered by the run engine.
        </p>
      </div>

      <Card>
        <CardBody className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-ink-500">State</span>
          {["", "open", "resolved", "dismissed"].map((s) => (
            <Button
              key={s || "all"}
              size="sm"
              variant={s === stateFilter ? "primary" : "ghost"}
              onClick={() => setStateFilter(s)}
            >
              {s || "All"}
            </Button>
          ))}
          <span className="ml-3 text-xs text-ink-500">Kind</span>
          <select
            className="rounded border border-ink-300 px-2 py-1 text-sm"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
          >
            <option value="">Any</option>
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </CardBody>
      </Card>

      {list.isLoading ? (
        <Banner><Spinner /> Loading escalations…</Banner>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState title="No escalations" description="The queue is clear for the selected filters." />
      ) : (
        <ul className="space-y-2">
          {list.data.map((e: Escalation) => (
            <Card key={e.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <Badge variant={
                    e.severity === "critical"
                      ? "danger"
                      : e.severity === "high"
                      ? "warn"
                      : "muted"
                  }>{e.severity}</Badge>
                  <Badge variant="brand">{KIND_LABELS[e.kind] || e.kind}</Badge>
                  <span>{e.title}</span>
                </CardTitle>
                <span className="ml-auto text-xs text-ink-500">{formatRelative(e.created_at)}</span>
              </CardHeader>
              <CardBody className="text-sm space-y-2">
                {e.description ? <p>{e.description}</p> : null}
                <div className="text-xs text-ink-500">
                  Notify: {(e.notify_roles || []).join(", ") || "—"}
                  {e.run_id ? (
                    <>
                      {" · "}
                      <Link href={`/console/runs/${e.run_id}`} className="underline">
                        Open run {e.run_id}
                      </Link>
                    </>
                  ) : null}
                </div>
                {e.required_action ? (
                  <Banner tone={e.severity === "critical" ? "danger" : "warn"}>
                    {e.required_action}
                  </Banner>
                ) : null}
                {e.resolution_state === "open" ? (
                  canResolve ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ok"
                        onClick={() => resolveM.mutate({ id: e.id, decision: "resolved" })}
                        disabled={resolveM.isPending}
                      >
                        Mark resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resolveM.mutate({ id: e.id, decision: "dismissed" })}
                        disabled={resolveM.isPending}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null
                ) : (
                  <div className="text-xs text-ink-500">
                    {e.resolution_state} {e.resolved_at ? `· ${formatRelative(e.resolved_at)}` : ""}
                    {e.resolution_notes ? ` · ${e.resolution_notes}` : ""}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
