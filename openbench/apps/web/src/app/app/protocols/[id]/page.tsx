"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { protocols, runs } from "@/lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Label,
  Spinner,
} from "@/components/ui";

type AckKey = "documents" | "ppe" | "controls" | "stop_conditions" | "sync";

export default function PreflightPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id as string;
  const v = useQuery({ queryKey: ["pv", id], queryFn: () => protocols.getVersion(id) });
  const create = useMutation({
    mutationFn: () => runs.create(id),
    onSuccess: async (r) => {
      try {
        await runs.preflight(r.id);
      } catch {}
      await runs.start(r.id);
      router.push(`/app/runs/${r.id}`);
    },
  });

  const [acks, setAcks] = useState<Record<AckKey, boolean>>({
    documents: false,
    ppe: false,
    controls: false,
    stop_conditions: false,
    sync: typeof navigator !== "undefined" ? navigator.onLine : true,
  });

  const ppe = useMemo(() => {
    if (!v.data) return [] as string[];
    const set = new Set<string>();
    v.data.steps.forEach((s) => (s.required_ppe_json || []).forEach((p) => set.add(p)));
    return Array.from(set);
  }, [v.data]);

  const controls = useMemo(() => {
    if (!v.data) return [] as string[];
    const set = new Set<string>();
    v.data.steps.forEach((s) => (s.controls_json || []).forEach((p) => set.add(p)));
    return Array.from(set);
  }, [v.data]);

  const stopConditions = useMemo(() => {
    if (!v.data) return [] as string[];
    const set = new Set<string>();
    v.data.steps.forEach((s) => (s.stop_conditions_json || []).forEach((p) => set.add(p)));
    return Array.from(set);
  }, [v.data]);

  const conflicts = (v.data?.compiler_metadata?.conflicts as any[]) || [];
  const gaps = (v.data?.compiler_metadata?.gaps as any[]) || [];
  const synthCards = (v.data?.compiler_metadata?.synthesis_cards as any[]) || [];

  const allAck = Object.values(acks).every(Boolean);

  if (v.isLoading) return <Spinner />;
  if (!v.data) return <Banner tone="danger">Protocol version not found.</Banner>;

  const ver = v.data;
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{ver.name}</h1>
        <p className="text-sm text-ink-500">
          Preflight check. Confirm you have everything you need before starting the run.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source documents</CardTitle>
          {ver.compiler_metadata?.missing_coverage?.length ? (
            <Badge variant="warn" className="ml-auto">
              {ver.compiler_metadata.missing_coverage.length} coverage gap(s)
            </Badge>
          ) : null}
        </CardHeader>
        <CardBody className="text-sm">
          <ul className="list-disc pl-5">
            {ver.source_doc_ids.map((d: string) => (
              <li key={d}><code className="text-xs">{d}</code></li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acks.documents}
              onChange={(e) => setAcks((s) => ({ ...s, documents: e.target.checked }))}
              className="bench-target"
            />
            I confirm the source documents are still the approved versions.
          </label>
        </CardBody>
      </Card>

      {(conflicts.length > 0 || gaps.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-warn-700">Cross-document conflicts and gaps</CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-2">
            {conflicts.map((c: any, i: number) => (
              <div key={i} className="border-l-4 border-warn-500 bg-warn-50 px-3 py-2 rounded">
                <div className="font-medium">{c.topic}</div>
                <div className="text-xs text-ink-700">{c.summary}</div>
                <div className="text-xs text-ink-500 mt-1">
                  Severity: {c.severity}; Steps: {(c.step_keys || []).join(", ") || "—"}
                </div>
              </div>
            ))}
            {gaps.map((g: any, i: number) => (
              <div key={i} className="border-l-4 border-danger-500 bg-danger-50 px-3 py-2 rounded">
                <div className="font-medium">Missing: {g.missing}</div>
                <div className="text-xs text-ink-500">
                  Severity: {g.severity}; Steps: {(g.step_keys || []).join(", ") || "—"}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {synthCards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Synthesis cards (cross-doc reasoning)</CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-2">
            {synthCards.map((s: any, i: number) => (
              <div key={i} className="border-l-4 border-brand-500 bg-brand-50 px-3 py-2 rounded">
                <div className="font-medium">{s.topic}</div>
                <div className="text-ink-700">{s.combined_requirement}</div>
                <div className="text-xs text-ink-500 mt-1">
                  Steps: {(s.step_keys || []).join(", ") || "—"} ·{" "}
                  Sources: {(s.sources || []).map((x: any) => x.document_id).join(", ")}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {ppe.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Required PPE</CardTitle></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-1 mb-2">
              {ppe.map((p) => (
                <Badge key={p} variant="warn">{p}</Badge>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acks.ppe}
                onChange={(e) => setAcks((s) => ({ ...s, ppe: e.target.checked }))}
                className="bench-target"
              />
              I have all required PPE on hand.
            </label>
          </CardBody>
        </Card>
      )}

      {controls.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Engineering controls / ventilation</CardTitle></CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 text-sm mb-2">
              {controls.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acks.controls}
                onChange={(e) => setAcks((s) => ({ ...s, controls: e.target.checked }))}
                className="bench-target"
              />
              Engineering controls are functioning.
            </label>
          </CardBody>
        </Card>
      )}

      {stopConditions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-danger-600">Stop conditions</CardTitle></CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 text-sm text-danger-700 mb-2">
              {stopConditions.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acks.stop_conditions}
                onChange={(e) => setAcks((s) => ({ ...s, stop_conditions: e.target.checked }))}
                className="bench-target"
              />
              I understand the stop conditions and will halt if any occur.
            </label>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Sync status</CardTitle></CardHeader>
        <CardBody>
          <Banner tone={acks.sync ? "ok" : "warn"}>
            {acks.sync
              ? "Online — events will sync in real time."
              : "Offline — events will be queued and synced when connectivity returns."}
          </Banner>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acks.sync}
              onChange={(e) => setAcks((s) => ({ ...s, sync: e.target.checked }))}
              className="bench-target"
            />
            I have reviewed the sync status.
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Steps ({ver.steps.length})</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {ver.steps.map((s) => (
            <div key={s.id} className="border border-ink-200 rounded p-3">
              <div className="flex items-center gap-2">
                <Badge variant="brand">{s.step_key}</Badge>
                <h3 className="font-semibold text-sm">{s.title}</h3>
                {s.confidence_score < 0.6 ? (
                  <Badge variant="warn">low confidence</Badge>
                ) : null}
              </div>
              <p className="text-xs text-ink-600 mt-1 line-clamp-2">{s.instruction}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex gap-3 pb-6">
        <Button
          size="lg"
          onClick={() => create.mutate()}
          disabled={create.isPending || !allAck}
          title={!allAck ? "Complete all preflight acknowledgements first" : ""}
        >
          {create.isPending ? "Starting…" : allAck ? "Start run →" : "Acknowledge all to start"}
        </Button>
      </div>
    </div>
  );
}
