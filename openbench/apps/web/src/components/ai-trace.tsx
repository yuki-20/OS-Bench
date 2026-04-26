"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { aiTrace, AITraceItem } from "@/lib/api";
import { Badge, Card, CardBody, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";

const TASK_LABELS: Record<string, string> = {
  qa: "Q&A",
  photo_check: "Vision check",
  protocol_compile: "Protocol compile",
  hazard_map: "Hazard map",
  conflict_resolve: "Conflict resolver",
  safety_review: "Safety review",
  report: "Report",
};

function ConfidenceBadge({ value }: { value: string }) {
  const tone = value === "high" ? "ok" : value === "low" ? "warn" : "muted";
  return <Badge variant={tone}>conf: {value}</Badge>;
}

function CitationsCell({ trace }: { trace: AITraceItem }) {
  const pct = Math.round((trace.citation_coverage || 0) * 100);
  const tone = pct >= 80 ? "ok" : pct >= 50 ? "warn" : "danger";
  return (
    <div className="text-xs flex items-center gap-2">
      <Badge variant={tone}>{pct}% citation coverage</Badge>
      <span className="text-ink-500">{trace.citation_count} cites</span>
    </div>
  );
}

export function AITracePanel({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const traces = useQuery({
    queryKey: ["ai-trace", runId],
    queryFn: () => aiTrace.list(runId),
    refetchInterval: 8000,
    enabled: open,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>AI Trace</span>
          <Badge variant="brand">Opus 4.7</Badge>
          <span className="text-xs text-ink-500 font-normal">
            Inputs · sources · schema · safety · run-state effect
          </span>
        </CardTitle>
        <button
          className="ml-auto text-xs text-brand-700 hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </CardHeader>
      {open ? (
        <CardBody className="p-0">
          {traces.isLoading ? (
            <div className="p-4 text-ink-500"><Spinner /> Loading traces…</div>
          ) : !traces.data || traces.data.length === 0 ? (
            <div className="p-4 text-sm text-ink-500">
              No AI calls have been made for this run yet.
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {traces.data.map((t) => (
                <TraceRow key={t.id} trace={t} />
              ))}
            </ul>
          )}
        </CardBody>
      ) : null}
    </Card>
  );
}

function TraceRow({ trace }: { trace: AITraceItem }) {
  const [expanded, setExpanded] = useState(false);
  const sr = trace.safety_review || {};
  const verdict: string | undefined = sr?.verdict;
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="brand">{TASK_LABELS[trace.task_type] || trace.task_type}</Badge>
        <span className="text-ink-500 text-xs">{trace.model}</span>
        {trace.step_id ? <code className="text-[10px] text-ink-500">{trace.step_id}</code> : null}
        <ConfidenceBadge value={trace.confidence} />
        {trace.changed_run_state ? (
          <Badge variant="warn">changed run state</Badge>
        ) : null}
        {trace.requires_human_review ? <Badge variant="warn">needs review</Badge> : null}
        {verdict ? (
          <Badge variant={verdict === "pass" ? "ok" : verdict === "block" ? "danger" : "warn"}>
            safety: {verdict}
          </Badge>
        ) : null}
        {trace.error ? <Badge variant="danger">error</Badge> : null}
        <span className="ml-auto text-xs text-ink-500">{formatRelative(trace.created_at)}</span>
      </div>
      <div className="mt-1 text-ink-700 line-clamp-2">{trace.input_summary || "—"}</div>
      <div className="mt-1 flex items-center gap-3 text-xs text-ink-500">
        <span>schema: <code>{trace.output_schema}</code></span>
        <CitationsCell trace={trace} />
        <span>{trace.latency_ms} ms</span>
        <button
          className={cn(
            "ml-auto text-brand-700 hover:underline",
            expanded ? "underline" : "",
          )}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 grid lg:grid-cols-2 gap-3 text-xs">
          <div className="bg-ink-50 rounded p-2">
            <div className="font-semibold mb-1 text-ink-700">Sources</div>
            <div className="text-ink-700">
              {trace.source_document_ids.length > 0 ? (
                <ul className="list-disc pl-4">
                  {trace.source_document_ids.map((d) => (
                    <li key={d}>
                      <code>{d}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-500">No sources recorded.</span>
              )}
            </div>
            {trace.source_chunk_ids.length > 0 ? (
              <div className="mt-2 text-ink-500">
                Chunks: {trace.source_chunk_ids.map((c) => `[${c}]`).join(" ")}
              </div>
            ) : null}
          </div>
          <div className="bg-ink-50 rounded p-2">
            <div className="font-semibold mb-1 text-ink-700">Output</div>
            <pre className="whitespace-pre-wrap text-[11px] text-ink-800">
              {JSON.stringify(trace.output_json, null, 2).slice(0, 2400)}
            </pre>
          </div>
          {sr && Object.keys(sr).length > 0 ? (
            <div className="bg-ink-50 rounded p-2 lg:col-span-2">
              <div className="font-semibold mb-1 text-ink-700">Safety review</div>
              <pre className="whitespace-pre-wrap text-[11px] text-ink-800">
                {JSON.stringify(sr, null, 2)}
              </pre>
            </div>
          ) : null}
          {trace.error ? (
            <div className="bg-danger-50 rounded p-2 lg:col-span-2 text-danger-600">
              <div className="font-semibold mb-1">Error</div>
              <pre className="whitespace-pre-wrap text-[11px]">{trace.error}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
