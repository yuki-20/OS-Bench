"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
  Textarea,
} from "@/components/ui";
import { protocols } from "@/lib/api";

export default function DraftReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const qc = useQueryClient();
  const draft = useQuery({
    queryKey: ["draft", id],
    queryFn: () => protocols.getDraft(id),
  });

  const publish = useMutation({
    mutationFn: () => protocols.publishDraft(id),
    onSuccess: () => router.push(`/console/protocols/${id}`),
  });

  if (draft.isLoading) return <div className="text-ink-500"><Spinner /> Loading draft…</div>;
  if (draft.isError || !draft.data) return <Banner tone="danger">Failed to load draft.</Banner>;

  const v = draft.data;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{v.name}</h1>
          <p className="text-sm text-ink-500">
            Draft <code className="text-xs">{v.id}</code> · status <Badge>{v.status}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ok"
            onClick={() => {
              if (confirm("Publish this draft? Published versions are immutable and runnable.")) {
                publish.mutate();
              }
            }}
            disabled={publish.isPending || v.status !== "draft"}
          >
            {publish.isPending ? "Publishing…" : "Publish version"}
          </Button>
        </div>
      </div>

      {v.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-ink-700 whitespace-pre-wrap">{v.summary}</p>
          </CardBody>
        </Card>
      )}

      {v.compiler_metadata?.missing_coverage && v.compiler_metadata.missing_coverage.length > 0 && (
        <Banner tone="warn" title="Missing safety coverage">
          <ul className="list-disc pl-5 mt-1">
            {v.compiler_metadata.missing_coverage.map((m: string, i: number) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-ink-800">Steps ({v.steps.length})</h2>
          {v.steps.map((s) => (
            <StepEditor key={s.id} versionId={id} step={s} qc={qc} />
          ))}
        </div>
        <div className="space-y-3">
          <h2 className="font-semibold text-ink-800">Hazard rules ({v.hazard_rules.length})</h2>
          {v.hazard_rules.map((h) => (
            <Card key={h.id}>
              <CardBody>
                <div className="flex justify-between items-center mb-1">
                  <Badge
                    variant={
                      h.severity === "critical" || h.severity === "high"
                        ? "danger"
                        : h.severity === "low"
                        ? "muted"
                        : "warn"
                    }
                  >
                    {h.category} · {h.severity}
                  </Badge>
                </div>
                <p className="text-sm text-ink-700">{h.requirement_text}</p>
                {h.source_refs_json.length > 0 && (
                  <div className="text-[11px] text-ink-500 mt-2">
                    Sources:{" "}
                    {h.source_refs_json.map((r: any, i: number) => (
                      <span key={i}>
                        {r.section_label || r.page_no ? `${r.section_label || ""} p.${r.page_no || "?"}` : r.document_id}
                        {i < h.source_refs_json.length - 1 ? "; " : ""}
                      </span>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepEditor({ versionId, step, qc }: { versionId: string; step: any; qc: any }) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(step.title);
  const [instruction, setInstruction] = useState(step.instruction);
  const [reviewerNotes, setReviewerNotes] = useState(step.reviewer_notes || "");

  const patch = useMutation({
    mutationFn: () =>
      protocols.patchDraft(versionId, {
        patch_step_id: step.id,
        patch_step: { title, instruction, reviewer_notes: reviewerNotes },
      }),
    onSuccess: () => {
      setEdit(false);
      qc.invalidateQueries({ queryKey: ["draft", versionId] });
    },
  });

  const conf = step.confidence_score >= 0.8 ? "ok" : step.confidence_score >= 0.5 ? "warn" : "danger";
  return (
    <Card>
      <CardHeader className="justify-between">
        <CardTitle className="flex items-center gap-2">
          <Badge variant="brand">{step.step_key}</Badge>
          <span>{title}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={conf as any}>conf {(step.confidence_score * 100).toFixed(0)}%</Badge>
          <Button size="sm" variant="ghost" onClick={() => setEdit((v) => !v)}>
            {edit ? "Cancel" : "Edit"}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        {edit ? (
          <>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <Label>Instruction</Label>
            <Textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            <Label>Reviewer notes</Label>
            <Textarea rows={2} value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} />
            <Button size="sm" onClick={() => patch.mutate()} disabled={patch.isPending}>
              {patch.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-700 whitespace-pre-wrap">{step.instruction}</p>
            {step.required_ppe_json.length > 0 && (
              <div className="text-xs text-ink-600">
                <strong>PPE:</strong> {step.required_ppe_json.join(", ")}
              </div>
            )}
            {step.controls_json.length > 0 && (
              <div className="text-xs text-ink-600">
                <strong>Controls:</strong> {step.controls_json.join(", ")}
              </div>
            )}
            {step.materials_json.length > 0 && (
              <div className="text-xs text-ink-600">
                <strong>Materials:</strong> {step.materials_json.join(", ")}
              </div>
            )}
            {step.timers_json.length > 0 && (
              <div className="text-xs text-ink-600">
                <strong>Timers:</strong>{" "}
                {step.timers_json.map((t: any, i: number) => (
                  <span key={i}>{t.label} ({t.duration_seconds}s){i < step.timers_json.length - 1 ? "; " : ""}</span>
                ))}
              </div>
            )}
            {step.visual_checks_json.length > 0 && (
              <div className="text-xs text-ink-600">
                <strong>Visual checks:</strong>
                <ul className="list-disc pl-4 mt-1">
                  {step.visual_checks_json.map((c: any) => (
                    <li key={c.check_id}>
                      <code>{c.check_id}</code>: {c.claim}{" "}
                      {c.required ? <Badge variant="warn">required</Badge> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {step.stop_conditions_json.length > 0 && (
              <div className="text-xs text-danger-600">
                <strong>Stop conditions:</strong> {step.stop_conditions_json.join(" · ")}
              </div>
            )}
            {step.source_refs_json.length > 0 && (
              <div className="text-[11px] text-ink-500 pt-2 border-t border-ink-100">
                Sources:{" "}
                {step.source_refs_json.map((r: any, i: number) => (
                  <span key={i}>
                    {r.section_label || `page ${r.page_no || "?"}`} ({r.document_id})
                    {i < step.source_refs_json.length - 1 ? "; " : ""}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
