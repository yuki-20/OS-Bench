"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { evaluations, EvaluationRun } from "@/lib/api";
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
  Stat,
} from "@/components/ui";
import { formatRelative } from "@/lib/format";

const TARGET_LABELS: Record<string, string> = {
  protocol_extraction: "Protocol step extraction",
  safety_citation_coverage: "Safety/PPE citations",
  critical_unsupported_claims: "Critical unsupported claims",
  visual_false_safe: "Visual false-safe rate",
  cannot_verify_used_correctly: "Cannot-verify usage",
  handover_event_coverage: "Handover event coverage",
  prompt_injection_rejection: "Prompt-injection rejection",
  step_qa_citation_coverage: "Step Q&A citation coverage",
  run_state_outside_model: "Run state outside model",
  published_version_binding: "Published version binding",
};

export default function EvaluationPage() {
  const qc = useQueryClient();
  const golden = useQuery({ queryKey: ["golden-sets"], queryFn: evaluations.goldenSets });
  const list = useQuery({ queryKey: ["eval-list"], queryFn: () => evaluations.list() });

  const [busy, setBusy] = useState<string | null>(null);
  const onSettled = () => {
    setBusy(null);
    qc.invalidateQueries({ queryKey: ["eval-list"] });
  };
  const safety = useMutation({
    mutationFn: () => evaluations.runSafetyRedteam(),
    onMutate: () => setBusy("safety_redteam"),
    onSettled,
  });
  const binding = useMutation({
    mutationFn: () => evaluations.runStateBinding(),
    onMutate: () => setBusy("run_state_binding"),
    onSettled,
  });
  const extraction = useMutation({
    mutationFn: () => evaluations.runProtocolExtraction(),
    onMutate: () => setBusy("protocol_extraction"),
    onSettled,
  });
  const vision = useMutation({
    mutationFn: () => evaluations.runVision(),
    onMutate: () => setBusy("vision_check"),
    onSettled,
  });

  const summary = useMemo(() => {
    const out: Record<string, EvaluationRun | undefined> = {};
    for (const r of list.data || []) {
      if (!out[r.kind] || (r.created_at > (out[r.kind]?.created_at ?? ""))) {
        out[r.kind] = r;
      }
    }
    return out;
  }, [list.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Evaluation harness</h1>
        <p className="text-sm text-ink-500">
          PRD §31 — golden test sets, vision cases, safety red-team prompts, and pass-target rubric.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Run evaluations</CardTitle></CardHeader>
        <CardBody className="flex gap-2 flex-wrap">
          <Button
            onClick={() => extraction.mutate()}
            disabled={busy === "protocol_extraction"}
          >
            {busy === "protocol_extraction" ? "Running…" : "Protocol extraction"}
          </Button>
          <Button
            onClick={() => safety.mutate()}
            disabled={busy === "safety_redteam"}
          >
            {busy === "safety_redteam" ? "Running…" : "Safety red-team"}
          </Button>
          <Button
            onClick={() => binding.mutate()}
            disabled={busy === "run_state_binding"}
          >
            {busy === "run_state_binding" ? "Running…" : "Run-state binding check"}
          </Button>
          <Button
            onClick={() => vision.mutate()}
            disabled={busy === "vision_check"}
          >
            {busy === "vision_check" ? "Running…" : "Vision fixtures (12)"}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pass targets (PRD 31.4)</CardTitle></CardHeader>
        <CardBody>
          {golden.isLoading ? (
            <Spinner />
          ) : golden.data ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(golden.data.targets).map(([k, target]) => (
                <Stat
                  key={k}
                  label={TARGET_LABELS[k] || k}
                  value={`${Math.round(target * 100)}%`}
                  hint="V1 target"
                />
              ))}
            </div>
          ) : (
            <Banner tone="danger">Failed to load golden sets.</Banner>
          )}
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        {(["protocol_extraction", "safety_redteam", "run_state_binding"] as const).map((kind) => {
          const r = summary[kind];
          return (
            <Card key={kind}>
              <CardHeader>
                <CardTitle>{TARGET_LABELS[kind] || kind}</CardTitle>
              </CardHeader>
              <CardBody>
                {r ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={r.score >= r.target ? "ok" : "warn"}>
                        {(r.score * 100).toFixed(0)}% / target {(r.target * 100).toFixed(0)}%
                      </Badge>
                      <span className="text-ink-500 text-xs">{formatRelative(r.created_at)}</span>
                    </div>
                    <div className="text-xs text-ink-500">
                      passed {r.passed} / {r.total_cases}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">No results yet — run the evaluation above.</p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Recent evaluation runs</CardTitle></CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="p-4 text-ink-500"><Spinner /> Loading…</div>
          ) : !list.data || list.data.length === 0 ? (
            <EmptyState
              title="No evaluations yet"
              description="Run one of the evaluations above to populate the dashboard."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs text-ink-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Score</th>
                  <th className="px-3 py-2 text-left">Passed</th>
                  <th className="px-3 py-2 text-left">Failed</th>
                  <th className="px-3 py-2 text-left">When</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((r) => (
                  <tr key={r.id} className="border-t border-ink-100">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2"><Badge variant="brand">{r.kind}</Badge></td>
                    <td className="px-3 py-2">
                      <Badge variant={r.score >= r.target ? "ok" : "warn"}>
                        {(r.score * 100).toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-ok-600">{r.passed}</td>
                    <td className="px-3 py-2 text-warn-600">{r.failed}</td>
                    <td className="px-3 py-2 text-ink-500 text-xs">{formatRelative(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Golden test sets</CardTitle></CardHeader>
        <CardBody>
          {golden.data ? (
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">Protocol packs ({golden.data.protocol_packs.length})</h4>
                <ul className="text-xs space-y-1">
                  {golden.data.protocol_packs.map((p: any) => (
                    <li key={p.id}><code>{p.id}</code> · {p.name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Vision cases ({golden.data.vision_cases.length})</h4>
                <ul className="text-xs space-y-1">
                  {golden.data.vision_cases.map((p: any) => (
                    <li key={p.id}><code>{p.id}</code> · {p.scenario}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Safety prompts ({golden.data.safety_prompts.length})</h4>
                <ul className="text-xs space-y-1">
                  {golden.data.safety_prompts.map((p: any) => (
                    <li key={p.id}><code>{p.id}</code> · {p.prompt.slice(0, 60)}…</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
