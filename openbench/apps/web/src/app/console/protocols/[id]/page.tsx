"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge, Banner, Button, Card, CardBody, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { protocols } from "@/lib/api";

export default function PublishedVersionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id as string;
  const qc = useQueryClient();
  const v = useQuery({ queryKey: ["pv", id], queryFn: () => protocols.getVersion(id) });
  const archive = useMutation({
    mutationFn: () => protocols.archiveVersion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pv", id] }),
  });

  if (v.isLoading) return <div className="text-ink-500"><Spinner /> Loading…</div>;
  if (v.isError || !v.data) return <Banner tone="danger">Failed to load version.</Banner>;
  const ver = v.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ver.name}</h1>
          <p className="text-sm text-ink-500">
            Version <Badge>{ver.version_label}</Badge> · status <Badge>{ver.status}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/protocols">
            <Button variant="secondary">Open in Bench</Button>
          </Link>
          {ver.status === "published" && (
            <Button variant="ghost" onClick={() => archive.mutate()}>Archive</Button>
          )}
        </div>
      </div>
      {ver.summary && (
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardBody><p className="text-sm whitespace-pre-wrap">{ver.summary}</p></CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Steps</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {ver.steps.map((s) => (
            <div key={s.id} className="border border-ink-200 rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="brand">{s.step_key}</Badge>
                <h3 className="font-semibold">{s.title}</h3>
              </div>
              <p className="text-sm text-ink-700">{s.instruction}</p>
              {(s.required_ppe_json.length > 0 || s.stop_conditions_json.length > 0) && (
                <div className="mt-2 text-xs text-ink-600 space-y-1">
                  {s.required_ppe_json.length > 0 && (
                    <div><strong>PPE:</strong> {s.required_ppe_json.join(", ")}</div>
                  )}
                  {s.stop_conditions_json.length > 0 && (
                    <div className="text-danger-600">
                      <strong>Stop:</strong> {s.stop_conditions_json.join(" · ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      {ver.hazard_rules.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Hazards</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {ver.hazard_rules.map((h) => (
              <div key={h.id} className="text-sm flex gap-2 border-b border-ink-100 py-2">
                <Badge
                  variant={
                    h.severity === "critical" || h.severity === "high"
                      ? "danger"
                      : "warn"
                  }
                >
                  {h.category}
                </Badge>
                <span>{h.requirement_text}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {(((ver.compiler_metadata?.conflicts as any[]) || []).length > 0 ||
        ((ver.compiler_metadata?.gaps as any[]) || []).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Cross-document conflicts and gaps</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            {(ver.compiler_metadata.conflicts || []).map((c: any, i: number) => (
              <div key={i} className="border-l-4 border-warn-500 bg-warn-50 px-3 py-2 rounded">
                <div className="font-medium">{c.topic}</div>
                <div className="text-xs">{c.summary}</div>
                <div className="text-xs text-ink-500">
                  Severity: {c.severity}; Steps: {(c.step_keys || []).join(", ") || "—"}
                </div>
                <ul className="text-xs mt-1 list-disc pl-5">
                  {(c.sources || []).map((s: any, j: number) => (
                    <li key={j}>
                      <code>{s.document_id}</code>
                      {s.section_label ? ` · ${s.section_label}` : ""} —{" "}
                      <em>{s.quote_summary}</em>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {(ver.compiler_metadata.gaps || []).map((g: any, i: number) => (
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

      {((ver.compiler_metadata?.synthesis_cards as any[]) || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Synthesis cards (Opus cross-document reasoning)</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            {ver.compiler_metadata.synthesis_cards.map((s: any, i: number) => (
              <div key={i} className="border-l-4 border-brand-500 bg-brand-50 px-3 py-2 rounded">
                <div className="font-medium">{s.topic}</div>
                <p>{s.combined_requirement}</p>
                <div className="text-xs text-ink-500">
                  Steps: {(s.step_keys || []).join(", ") || "—"}
                </div>
                <ul className="text-xs mt-1 list-disc pl-5">
                  {(s.sources || []).map((src: any, j: number) => (
                    <li key={j}>
                      <code>{src.document_id}</code>
                      {src.section_label ? ` · ${src.section_label}` : ""} —{" "}
                      <em>{src.quote_summary}</em>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
