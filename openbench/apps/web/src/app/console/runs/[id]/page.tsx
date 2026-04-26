"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { protocols, runs } from "@/lib/api";
import { AITracePanel } from "@/components/ai-trace";
import { EscalationsPanel } from "@/components/escalations";
import { Badge, Banner, Button, Card, CardBody, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["run", id], queryFn: () => runs.get(id) });
  const handover = useQuery({
    queryKey: ["run-handover", id],
    queryFn: () =>
      runs.getHandover(id).catch(() => null),
  });
  const generate = useMutation({
    mutationFn: () => runs.generateHandover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run-handover", id] }),
  });
  const finalize = useMutation({
    mutationFn: () => runs.finalizeHandover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run-handover", id] }),
  });

  if (detail.isLoading) return <div className="text-ink-500"><Spinner /> Loading run…</div>;
  if (detail.isError || !detail.data) return <Banner tone="danger">Failed to load run.</Banner>;

  const d = detail.data;
  const r = d.run;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Run <code className="text-base">{r.id}</code></h1>
          <p className="text-sm text-ink-500">
            Status <Badge>{r.status}</Badge> · Operator <code>{r.operator_id}</code> · Started {formatDateTime(r.started_at)}
          </p>
          {r.block_reason && <Banner tone="warn">Block reason: {r.block_reason}</Banner>}
        </div>
        <div className="flex gap-2">
          <Link href={`/app/runs/${r.id}`}>
            <Button variant="secondary">Open in Bench</Button>
          </Link>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "Generating…" : "Generate handover"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader><CardTitle>Step states</CardTitle></CardHeader>
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-xs text-ink-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Step</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Started</th>
                    <th className="px-3 py-2 text-left">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {d.step_states.map((s) => (
                    <tr key={s.id} className="border-t border-ink-100">
                      <td className="px-3 py-2"><code className="text-xs">{s.step_id}</code></td>
                      <td className="px-3 py-2">
                        <Badge variant={
                          s.status === "completed"
                            ? "ok"
                            : s.status === "blocked"
                            ? "danger"
                            : s.status === "skipped"
                            ? "muted"
                            : "brand"
                        }>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-500">{formatDateTime(s.started_at)}</td>
                      <td className="px-3 py-2 text-xs text-ink-500">{formatDateTime(s.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          {d.deviations.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Deviations</CardTitle></CardHeader>
              <CardBody className="space-y-2">
                {d.deviations.map((dv) => (
                  <div key={dv.id} className="border border-ink-200 rounded p-2">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-sm">{dv.title}</div>
                      <Badge variant={
                        dv.severity === "critical" ? "danger" : dv.severity === "high" ? "warn" : "muted"
                      }>{dv.severity}</Badge>
                    </div>
                    {dv.description && <p className="text-xs text-ink-600 mt-1">{dv.description}</p>}
                    <div className="text-[11px] text-ink-500 mt-1">{formatRelative(dv.created_at)}</div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {d.photo_assessments.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Photo assessments</CardTitle></CardHeader>
              <CardBody className="space-y-2">
                {d.photo_assessments.map((p: any) => (
                  <div key={p.id} className="border border-ink-200 rounded p-2 text-sm">
                    <div className="flex justify-between">
                      <code className="text-xs">{p.step_id}</code>
                      <Badge variant={p.overall_status === "ok" ? "ok" : p.overall_status === "stop" ? "danger" : "warn"}>
                        {p.overall_status}
                      </Badge>
                    </div>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {p.items.map((it: any, i: number) => (
                        <li key={i}>
                          <code>{it.check_id}</code>: {it.status} — {it.evidence}
                        </li>
                      ))}
                    </ul>
                    {p.recommended_action && (
                      <div className="text-xs mt-1 italic text-ink-500">{p.recommended_action}</div>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Event log</CardTitle></CardHeader>
            <CardBody className="p-0 max-h-96 overflow-auto scroll-soft">
              <table className="w-full text-xs">
                <thead className="bg-ink-50 text-ink-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Step</th>
                    <th className="px-3 py-2 text-left">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {d.events.map((e) => (
                    <tr key={e.id} className="border-t border-ink-100">
                      <td className="px-3 py-1 whitespace-nowrap text-ink-500">{formatDateTime(e.server_timestamp)}</td>
                      <td className="px-3 py-1">{e.event_type}</td>
                      <td className="px-3 py-1"><code>{e.step_id || "—"}</code></td>
                      <td className="px-3 py-1 max-w-[400px] truncate font-mono">
                        {JSON.stringify(e.payload_json)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader><CardTitle>Handover</CardTitle></CardHeader>
            <CardBody className="space-y-2">
              {handover.data ? (
                <>
                  <div className="text-xs text-ink-500">
                    Status: <Badge>{handover.data.status}</Badge> · generated{" "}
                    {formatRelative(handover.data.generated_at)}
                  </div>
                  <div className="prose-handover max-h-72 overflow-auto scroll-soft border border-ink-200 rounded p-2 text-xs"
                       dangerouslySetInnerHTML={{ __html: handover.data.html_body }} />
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => finalize.mutate()} disabled={finalize.isPending || handover.data.status === "finalized"}>
                      {finalize.isPending ? "Finalizing…" : handover.data.status === "finalized" ? "Finalized" : "Finalize PDF"}
                    </Button>
                    <a href={runs.pdfUrl(id)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="secondary">Download PDF</Button>
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-500">No handover yet. Generate one to summarize this run.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Timers</CardTitle></CardHeader>
            <CardBody className="text-sm space-y-1">
              {d.timers.length === 0 ? <span className="text-ink-500 text-xs">None</span> : null}
              {d.timers.map((t) => (
                <div key={t.id} className="flex justify-between">
                  <span>{t.label || "(unlabeled)"}</span>
                  <Badge>{t.status}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
          <EscalationsPanel runId={id} />
          <AITracePanel runId={id} />
        </div>
      </div>
    </div>
  );
}
