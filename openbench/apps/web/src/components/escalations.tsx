"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import { escalations, Escalation } from "@/lib/api";
import { Badge, Banner, Button, Card, CardBody, CardHeader, CardTitle, Spinner } from "@/components/ui";
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

function severityTone(s: string) {
  if (s === "critical") return "danger";
  if (s === "high") return "warn";
  if (s === "low") return "muted";
  return "default";
}

export function EscalationsPanel({ runId }: { runId?: string }) {
  const qc = useQueryClient();
  const { hasRole } = useSession();
  const canResolve = hasRole("manager") || hasRole("safety_lead") || hasRole("reviewer");
  const list = useQuery({
    queryKey: ["escalations", runId || "all"],
    queryFn: () => escalations.list({ run_id: runId, state: "open" }),
    refetchInterval: 6000,
  });
  const resolveM = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "resolved" | "dismissed" }) =>
      escalations.resolve(id, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escalations"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Open escalations</span>
          {list.data ? (
            <Badge variant={list.data.length ? "warn" : "muted"}>{list.data.length}</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {list.isLoading ? (
          <div className="p-4 text-ink-500"><Spinner /> Loading…</div>
        ) : !list.data || list.data.length === 0 ? (
          <div className="p-4 text-sm text-ink-500">No open escalations.</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.data.map((e: Escalation) => (
              <li key={e.id} className="p-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={severityTone(e.severity) as any}>{e.severity}</Badge>
                  <Badge variant="brand">{KIND_LABELS[e.kind] || e.kind}</Badge>
                  <span className="font-medium">{e.title}</span>
                  <span className="ml-auto text-xs text-ink-500">{formatRelative(e.created_at)}</span>
                </div>
                {e.description ? (
                  <div className="mt-1 text-ink-700">{e.description}</div>
                ) : null}
                <div className="mt-1 text-xs text-ink-500">
                  Notify: {(e.notify_roles || []).join(", ") || "—"}
                </div>
                {e.required_action ? (
                  <Banner tone={e.severity === "critical" ? "danger" : "warn"}>
                    {e.required_action}
                  </Banner>
                ) : null}
                {canResolve ? (
                  <div className="mt-2 flex gap-2">
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
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function BlockerBadge({ blockReason }: { blockReason?: string | null }) {
  if (!blockReason) return null;
  return (
    <Banner tone="warn" title="Blocker active">
      {blockReason}
    </Banner>
  );
}
