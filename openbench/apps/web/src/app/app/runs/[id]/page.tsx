"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { protocols, runs } from "@/lib/api";
import { enqueueEvent } from "@/lib/offline";
import { AITracePanel } from "@/components/ai-trace";
import { EscalationsPanel } from "@/components/escalations";
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
  Modal,
  Spinner,
  Textarea,
} from "@/components/ui";
import { Mic, MicOff } from "lucide-react";
import { formatDateTime } from "@/lib/format";

const idem = () => `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export default function LiveRunPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id as string;
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["run", runId],
    queryFn: () => runs.get(runId),
    refetchInterval: 5000,
  });
  const pv = useQuery({
    queryKey: ["pv-run", detail.data?.protocol_version_id],
    enabled: !!detail.data?.protocol_version_id,
    queryFn: () => protocols.getVersion(detail.data!.protocol_version_id),
  });

  const [photoOpen, setPhotoOpen] = useState(false);
  const [deviationOpen, setDeviationOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [askResult, setAskResult] = useState<any>(null);
  const [askBusy, setAskBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<any>(null);

  const currentStep = useMemo(() => {
    if (!detail.data || !pv.data) return null;
    const sid = detail.data.run.current_step_id;
    return pv.data.steps.find((s) => s.id === sid) || null;
  }, [detail.data, pv.data]);

  const stepState = useMemo(() => {
    if (!detail.data || !currentStep) return null;
    return detail.data.step_states.find((s) => s.step_id === currentStep.id);
  }, [detail.data, currentStep]);

  // --- mutations ---
  const completeStep = useMutation({
    mutationFn: ({ overrideBlock, reason }: { overrideBlock?: boolean; reason?: string }) =>
      runs.completeStep(runId, currentStep!.id, {
        override_block: overrideBlock,
        override_reason: reason,
        idempotency_key: idem(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run", runId] }),
  });
  const skipStep = useMutation({
    mutationFn: (reason: string) =>
      runs.skipStep(runId, currentStep!.id, reason, idem()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run", runId] }),
  });
  const startStep = useMutation({
    mutationFn: () => runs.startStep(runId, currentStep!.id, idem()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run", runId] }),
  });
  const startTimer = useMutation({
    mutationFn: (label_seconds: { label: string; duration_seconds: number }) =>
      runs.startTimer(runId, { ...label_seconds, step_id: currentStep?.id, idempotency_key: idem() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run", runId] }),
  });

  async function ask() {
    if (!askText.trim()) return;
    setAskBusy(true);
    setAskResult(null);
    try {
      const r = await runs.ask(runId, askText, currentStep?.id);
      setAskResult(r);
      // Always TTS-friendly answer
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(r.answer_text);
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      setAskResult({ answer_text: `Error: ${(e as Error).message}`, citations: [], confidence: "low", escalation_required: true });
    } finally {
      setAskBusy(false);
    }
  }

  // Voice (Web Speech API)
  function toggleVoice() {
    if (voiceOn) {
      recRef.current?.stop();
      setVoiceOn(false);
      return;
    }
    const SR =
      (typeof window !== "undefined" && (window as any).SpeechRecognition) ||
      (typeof window !== "undefined" && (window as any).webkitSpeechRecognition);
    if (!SR) {
      alert("Speech recognition is not supported in this browser. Use the typed Ask box.");
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        handleVoiceCommand(finalText.trim());
        setInterim("");
      }
    };
    r.onerror = () => setVoiceOn(false);
    r.onend = () => setVoiceOn(false);
    r.start();
    recRef.current = r;
    setVoiceOn(true);
  }

  function handleVoiceCommand(text: string) {
    const t = text.toLowerCase();
    // Lightweight command parser
    if (/(^|\s)(next( step)?|next)/.test(t)) {
      completeStep.mutate({});
    } else if (/repeat( step)?|read (step|aloud)/.test(t)) {
      if (currentStep) speakStep(currentStep);
    } else if (/^pause/.test(t)) {
      runs.pause(runId).then(() => qc.invalidateQueries({ queryKey: ["run", runId] }));
    } else if (/^resume|continue run/.test(t)) {
      runs.resume(runId).then(() => qc.invalidateQueries({ queryKey: ["run", runId] }));
    } else if (/log note/.test(t)) {
      const note = text.replace(/.*?log note[:\s]*/i, "").trim();
      if (note) {
        runs.addNote(runId, note, currentStep?.id, idem());
      }
    } else if (/mark deviation|log deviation/.test(t)) {
      setDeviationOpen(true);
    } else if (/(start )?timer/.test(t)) {
      startTimer.mutate({ label: "voice timer", duration_seconds: 300 });
    } else if (/check (setup|photo)|photo check/.test(t)) {
      setPhotoOpen(true);
    } else if (/generate handover/.test(t)) {
      runs.generateHandover(runId).then(() => qc.invalidateQueries({ queryKey: ["run", runId] }));
    } else {
      // treat as a question
      setAskText(text);
      setAskOpen(true);
      setTimeout(ask, 50);
    }
  }

  function speakStep(s: any) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const txt = `Step ${s.step_key}: ${s.title}. ${s.instruction}.`;
    const u = new SpeechSynthesisUtterance(txt);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }

  if (detail.isLoading) return <div className="text-ink-500"><Spinner /> Loading run…</div>;
  if (!detail.data) return <Banner tone="danger">Run not found.</Banner>;

  const run = detail.data.run;
  const progress = pv.data
    ? `${pv.data.steps.findIndex((s) => s.id === run.current_step_id) + 1} / ${pv.data.steps.length}`
    : "—";

  const orderedSteps = pv.data?.steps || [];
  const stepIndex = orderedSteps.findIndex((s) => s.id === run.current_step_id);

  return (
    <div className="space-y-4">
      {/* Top status bar */}
      <Card>
        <CardBody className="flex items-center gap-4 flex-wrap">
          <div className="text-xs text-ink-500">Run</div>
          <code className="text-sm">{run.id}</code>
          <Badge variant={
            run.status === "blocked" || run.status === "awaiting_override" ? "warn" :
            run.status === "completed" ? "ok" :
            run.status === "active" ? "brand" : "muted"
          }>{run.status}</Badge>
          {pv.data && <span className="text-sm text-ink-700">Step {progress}</span>}
          <div className="ml-auto flex gap-2 non-critical">
            <Button variant="ghost" size="sm" onClick={() => runs.pause(runId).then(() => detail.refetch())}>
              Pause
            </Button>
            <Button variant="ghost" size="sm" onClick={() => runs.resume(runId).then(() => detail.refetch())}>
              Resume
            </Button>
            <Button
              variant={voiceOn ? "warn" : "secondary"}
              size="sm"
              onClick={toggleVoice}
              title="Push-to-talk voice commands"
            >
              {voiceOn ? <MicOff size={14} /> : <Mic size={14} />}
              {voiceOn ? " Listening…" : " Voice"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {run.block_reason && (
        <Banner tone="warn" title="Run is blocked">
          {run.block_reason}
        </Banner>
      )}
      {voiceOn && interim && <div className="text-xs text-ink-500 italic">…{interim}</div>}

      {currentStep ? (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="brand">{currentStep.step_key}</Badge>
                  <span>{currentStep.title}</span>
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <p className="text-base text-ink-800 whitespace-pre-wrap leading-relaxed">
                  {currentStep.instruction}
                </p>

                {currentStep.required_ppe_json.length > 0 && (
                  <div className="text-sm">
                    <Label>Required PPE</Label>
                    <div className="flex flex-wrap gap-1">
                      {currentStep.required_ppe_json.map((p, i) => (
                        <Badge key={i} variant="warn">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep.controls_json.length > 0 && (
                  <div className="text-sm">
                    <Label>Engineering controls</Label>
                    <div className="flex flex-wrap gap-1">
                      {currentStep.controls_json.map((p, i) => (
                        <Badge key={i}>{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep.materials_json.length > 0 && (
                  <div className="text-sm">
                    <Label>Materials</Label>
                    <div className="flex flex-wrap gap-1">
                      {currentStep.materials_json.map((p, i) => (
                        <Badge key={i} variant="muted">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep.visual_checks_json.length > 0 && (
                  <div>
                    <Label>Visual checklist</Label>
                    <ul className="text-sm space-y-1">
                      {currentStep.visual_checks_json.map((c) => (
                        <li key={c.check_id} className="flex gap-2 items-start">
                          <code className="text-[11px] mt-0.5">{c.check_id}</code>
                          <span>{c.claim}</span>
                          {c.required && <Badge variant="warn">required</Badge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentStep.stop_conditions_json.length > 0 && (
                  <div>
                    <Label className="text-danger-600">Stop conditions</Label>
                    <ul className="text-sm list-disc pl-5 text-danger-600">
                      {currentStep.stop_conditions_json.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-3 border-t border-ink-100">
                  <Button size="lg" onClick={() => completeStep.mutate({})} disabled={completeStep.isPending}>
                    {completeStep.isPending ? "Completing…" : "Complete step →"}
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => speakStep(currentStep)}>
                    Read aloud
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => setPhotoOpen(true)}>
                    Photo check
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => setAskOpen(true)}>
                    Ask
                  </Button>
                  <Button
                    size="lg"
                    variant="warn"
                    onClick={() => setDeviationOpen(true)}
                  >
                    Mark deviation
                  </Button>
                  {currentStep.is_skippable && (
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={() => {
                        const reason = prompt("Reason to skip this step?");
                        if (reason) skipStep.mutate(reason);
                      }}
                    >
                      Skip
                    </Button>
                  )}
                  {currentStep.timers_json.map((t, i) => (
                    <Button
                      key={i}
                      size="md"
                      variant="ghost"
                      onClick={() =>
                        startTimer.mutate({ label: t.label, duration_seconds: t.duration_seconds })
                      }
                    >
                      ⏱ {t.label} · {t.duration_seconds}s
                    </Button>
                  ))}
                </div>

                {completeStep.isError && (
                  <Banner tone="warn" title="Step blocked by run engine">
                    {(completeStep.error as Error).message}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="warn"
                        onClick={() => {
                          const reason = prompt("Override reason?") || "";
                          if (reason) completeStep.mutate({ overrideBlock: true, reason });
                        }}
                      >
                        Override (request approval)
                      </Button>
                    </div>
                  </Banner>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sources cited for this step</CardTitle></CardHeader>
              <CardBody className="text-sm">
                {currentStep.source_refs_json.length === 0 ? (
                  <span className="text-ink-500 text-xs">No source refs found by the compiler.</span>
                ) : (
                  <ul className="list-disc pl-5">
                    {currentStep.source_refs_json.map((r, i) => (
                      <li key={i}>
                        <code className="text-xs">{r.document_id}</code>
                        {r.section_label ? ` · ${r.section_label}` : ""} {r.page_no ? ` · p.${r.page_no}` : ""}
                        {r.quote_summary ? (
                          <div className="text-xs italic text-ink-500">&quot;{r.quote_summary}&quot;</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Quick log</CardTitle></CardHeader>
              <CardBody>
                <NoteForm runId={runId} stepId={currentStep.id} />
              </CardBody>
            </Card>
          </div>

          <div className="space-y-3">
            <EscalationsPanel runId={runId} />
            <AITracePanel runId={runId} />
            <Card>
              <CardHeader><CardTitle>Run timeline</CardTitle></CardHeader>
              <CardBody className="p-0 max-h-[60vh] overflow-auto scroll-soft">
                <ul className="text-xs divide-y divide-ink-100">
                  {detail.data.events.slice().reverse().map((e) => (
                    <li key={e.id} className="px-3 py-2">
                      <div className="text-ink-500">{formatDateTime(e.server_timestamp)}</div>
                      <div>
                        <code>{e.event_type}</code>{" "}
                        {e.step_id ? <span className="text-ink-500">· {e.step_id}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="text-lg font-semibold">All steps complete</div>
            <p className="text-sm text-ink-500">Generate the handover report below.</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => runs.generateHandover(runId).then(() => detail.refetch())}>
                Generate handover
              </Button>
              <a href={`/app/runs/${runId}/handover`}>
                <Button variant="secondary">Open handover</Button>
              </a>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step list */}
      {pv.data && (
        <Card>
          <CardHeader><CardTitle>All steps</CardTitle></CardHeader>
          <CardBody className="p-0">
            <ul>
              {orderedSteps.map((s, i) => {
                const ss = detail.data!.step_states.find((x) => x.step_id === s.id);
                const isCurrent = run.current_step_id === s.id;
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-3 px-4 py-2 text-sm border-t border-ink-100 ${
                      isCurrent ? "bg-brand-50" : ""
                    }`}
                  >
                    <span className="w-6 text-ink-500">{i + 1}.</span>
                    <Badge variant="brand">{s.step_key}</Badge>
                    <span className="flex-1">{s.title}</span>
                    {ss ? <Badge variant={
                      ss.status === "completed" ? "ok" :
                      ss.status === "blocked" ? "danger" :
                      ss.status === "skipped" ? "muted" : "brand"
                    }>{ss.status}</Badge> : <span className="text-xs text-ink-400">pending</span>}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Modals */}
      <PhotoCheckModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        runId={runId}
        stepId={currentStep?.id}
        onDone={() => detail.refetch()}
      />
      <DeviationModal
        open={deviationOpen}
        onClose={() => setDeviationOpen(false)}
        runId={runId}
        stepId={currentStep?.id}
        onDone={() => detail.refetch()}
      />
      <Modal open={askOpen} onClose={() => setAskOpen(false)} title="Ask OpenBench">
        <div className="space-y-3">
          <Textarea
            rows={3}
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder="What PPE applies here? Where does the manual mention calibration?"
          />
          <Button onClick={ask} disabled={askBusy} className="w-full">
            {askBusy ? <><Spinner /> Asking…</> : "Ask"}
          </Button>
          {askResult && (
            <div className="space-y-2">
              <Banner tone={askResult.escalation_required ? "warn" : "info"}>
                {askResult.answer_text}
              </Banner>
              {askResult.citations?.length > 0 && (
                <div className="text-xs text-ink-500">
                  Sources:{" "}
                  {askResult.citations.map((c: any, i: number) => (
                    <span key={i}>
                      {c.section_label || `page ${c.page_no || "?"}`} ({c.document_id})
                      {i < askResult.citations.length - 1 ? "; " : ""}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-xs text-ink-500">
                Confidence: {askResult.confidence} ·{" "}
                {askResult.escalation_required ? "escalation suggested" : "no escalation"}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function NoteForm({ runId, stepId }: { runId: string; stepId: string }) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => runs.addNote(runId, text, stepId, idem()),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["run", runId] });
    },
  });
  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quick observation, sample comment, or measurement note…"
      />
      <Button
        size="sm"
        disabled={!text.trim() || m.isPending}
        onClick={async () => {
          if (!navigator.onLine) {
            await enqueueEvent({
              run_id: runId,
              event_type: "note_added",
              step_id: stepId,
              payload: { text },
            });
            setText("");
            qc.invalidateQueries({ queryKey: ["run", runId] });
            return;
          }
          m.mutate();
        }}
      >
        {m.isPending ? "Saving…" : "Add note"}
      </Button>
    </div>
  );
}

function PhotoCheckModal({
  open,
  onClose,
  runId,
  stepId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  runId: string;
  stepId?: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    setResult(null);
    setErr(null);
  }

  async function submit() {
    if (!file || !stepId) return;
    setBusy(true);
    setErr(null);
    try {
      const att = await runs.uploadAttachment(runId, file, stepId, "photo");
      const res = await runs.photoCheck(runId, stepId, att.id);
      setResult(res);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Photo check" width="max-w-3xl">
      <div className="space-y-3">
        <Banner>
          Upload a bench photo. The verifier checks only items in the active visual checklist and
          reports confirmed / not visible / cannot verify.
        </Banner>
        <input type="file" accept="image/*" capture="environment" onChange={onPick} />
        {preview && (
          <Image
            src={preview}
            alt="preview"
            width={640}
            height={360}
            unoptimized
            className="max-h-72 w-auto rounded border object-contain"
          />
        )}
        <Button onClick={submit} disabled={!file || busy}>
          {busy ? <><Spinner /> Assessing… (uses Claude vision)</> : "Run check"}
        </Button>
        {err && <Banner tone="danger">{err}</Banner>}
        {result && (
          <div className="space-y-2">
            <Banner
              tone={
                result.overall_status === "ok"
                  ? "ok"
                  : result.overall_status === "stop"
                  ? "danger"
                  : "warn"
              }
              title={`Overall: ${result.overall_status.replace("_", " ")}`}
            >
              {result.recommended_action || (result.overall_status === "ok" ? "All required visual checks confirmed." : "")}
            </Banner>
            <div className="grid grid-cols-2 gap-2 text-xs text-ink-500">
              <div>
                <Badge variant="ok">confirmed</Badge> visible & verifiable
              </div>
              <div>
                <Badge variant="warn">not_visible</Badge> required but not in frame
              </div>
              <div>
                <Badge variant="warn">unclear</Badge> needs retake
              </div>
              <div>
                <Badge variant="muted">cannot_verify</Badge> hidden by design
              </div>
            </div>
            <ul className="text-sm space-y-1">
              {result.items.map((it: any, i: number) => (
                <li key={i} className="border border-ink-200 rounded p-2">
                  <div className="flex justify-between items-center">
                    <code className="text-xs">{it.check_id}</code>
                    <div className="flex gap-1">
                      <Badge variant={
                        it.status === "confirmed" ? "ok" :
                        it.status === "not_visible" ? "warn" :
                        it.status === "unclear" ? "warn" : "muted"
                      }>{it.status}</Badge>
                      <Badge variant={
                        it.confidence === "high" ? "ok" :
                        it.confidence === "low" ? "warn" : "muted"
                      }>conf: {it.confidence || "medium"}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-ink-600 mt-1">{it.evidence}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DeviationModal({
  open,
  onClose,
  runId,
  stepId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  runId: string;
  stepId?: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "high" | "critical">("minor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await runs.addDeviation(runId, {
        step_id: stepId,
        title,
        description,
        severity,
        idempotency_key: idem(),
      });
      setTitle("");
      setDescription("");
      onDone();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark deviation">
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Severity</Label>
          <select
            className="w-full rounded border border-ink-300 px-3 py-2 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as any)}
          >
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        {err && <Banner tone="danger">{err}</Banner>}
        <Button onClick={submit} disabled={!title || busy} className="w-full">
          {busy ? "Saving…" : "Submit deviation"}
        </Button>
      </div>
    </Modal>
  );
}
