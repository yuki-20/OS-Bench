'use client';
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  StickyNote,
  Ruler,
  AlertTriangle,
  Timer,
  Sparkles,
  Camera,
  Loader2,
  Send,
  Upload,
} from 'lucide-react';
import { api, ApiError, type AskResponse, type PhotoAssessmentOut } from '@/lib/api';
import { useRunDetail } from './RunDetailContext';

const SEVERITIES = ['minor', 'moderate', 'major', 'high', 'critical'] as const;

export default function RunActionsTab() {
  const { detail, protocol, refresh } = useRunDetail();
  const [busy, setBusy] = useState<string | null>(null);
  const [askAnswer, setAskAnswer] = useState<AskResponse | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoAssessmentOut | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const stepOptions = useMemo(() => {
    if (!protocol) return [];
    return [...protocol.steps]
      .sort((a, b) => a.order_index - b.order_index)
      .map((s) => ({
        id: s.id,
        label: `S${(s.order_index + 1).toString().padStart(2, '0')} — ${s.title}`,
      }));
  }, [protocol]);

  const defaultStepId = detail?.run.current_step_id ?? stepOptions[0]?.id ?? '';

  // --- Note ---------------------------------------------------------------
  const [note, setNote] = useState({ text: '', step_id: defaultStepId });
  const submitNote = async () => {
    if (!detail || !note.text.trim()) {
      toast.error('Note text required');
      return;
    }
    setBusy('note');
    try {
      await api.addNote(detail.run.id, {
        text: note.text.trim(),
        step_id: note.step_id || null,
      });
      setNote({ text: '', step_id: defaultStepId });
      await refresh();
      toast.success('Note added');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // --- Measurement --------------------------------------------------------
  const [meas, setMeas] = useState({ key: '', value: '', units: '', step_id: defaultStepId });
  const submitMeasurement = async () => {
    if (!detail || !meas.key.trim() || !meas.value.trim() || !meas.step_id) {
      toast.error('Step, key, and value are required');
      return;
    }
    const numericValue = Number(meas.value);
    setBusy('meas');
    try {
      await api.addMeasurement(detail.run.id, {
        step_id: meas.step_id,
        key: meas.key.trim(),
        value: Number.isFinite(numericValue) ? numericValue : meas.value.trim(),
        units: meas.units.trim() || undefined,
      });
      setMeas({ key: '', value: '', units: '', step_id: defaultStepId });
      await refresh();
      toast.success('Measurement recorded');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // --- Deviation ----------------------------------------------------------
  const [dev, setDev] = useState({
    title: '',
    severity: 'moderate' as (typeof SEVERITIES)[number],
    description: '',
    step_id: defaultStepId,
  });
  const submitDeviation = async () => {
    if (!detail || !dev.title.trim()) {
      toast.error('Title required');
      return;
    }
    setBusy('dev');
    try {
      const created = await api.addDeviation(detail.run.id, {
        title: dev.title.trim(),
        severity: dev.severity,
        description: dev.description.trim(),
        step_id: dev.step_id || null,
      });
      setDev({ title: '', severity: 'moderate', description: '', step_id: defaultStepId });
      await refresh();
      toast.success(`Deviation logged (${created.severity})`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // --- Timer --------------------------------------------------------------
  const [timer, setTimer] = useState({ label: '', minutes: 5, step_id: defaultStepId });
  const submitTimer = async () => {
    if (!detail || !timer.label.trim() || !timer.minutes) {
      toast.error('Label and duration required');
      return;
    }
    setBusy('timer');
    try {
      await api.startTimer(detail.run.id, {
        label: timer.label.trim(),
        duration_seconds: Math.max(1, Math.round(timer.minutes * 60)),
        step_id: timer.step_id || null,
      });
      setTimer({ label: '', minutes: 5, step_id: defaultStepId });
      await refresh();
      toast.success('Timer started');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // --- Ask AI -------------------------------------------------------------
  const [ask, setAsk] = useState({ question: '', step_id: defaultStepId });
  const submitAsk = async () => {
    if (!detail || !ask.question.trim()) {
      toast.error('Type a question');
      return;
    }
    setBusy('ask');
    setAskAnswer(null);
    try {
      const res = await api.askAI(detail.run.id, {
        question: ask.question.trim(),
        step_id: ask.step_id || undefined,
        context_mode: ask.step_id ? 'current_step_only' : 'full_protocol',
      });
      setAskAnswer(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  // --- Photo + AI vision check -------------------------------------------
  const [photoStepId, setPhotoStepId] = useState(defaultStepId);
  const [photoInstruction, setPhotoInstruction] = useState('');
  const submitPhoto = async (file: File) => {
    if (!detail || !photoStepId) {
      toast.error('Pick a step first');
      return;
    }
    setBusy('photo');
    setPhotoResult(null);
    try {
      const att = await api.uploadAttachment(detail.run.id, file, 'photo', photoStepId);
      toast.success('Photo uploaded — running vision check…');
      const result = await api.photoCheck(detail.run.id, photoStepId, {
        attachment_id: att.id,
        instruction: photoInstruction.trim() || undefined,
      });
      setPhotoResult(result);
      await refresh();
      if (result.result === 'pass' || result.result === 'passed') {
        toast.success('Vision check passed');
      } else {
        toast.error(`Vision check ${result.result}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!detail) return null;

  const stepSelect = (value: string, onChange: (v: string) => void, allowEmpty = false) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-zinc-900 border border-border rounded-lg px-2 py-1.5 text-[12px]"
    >
      {allowEmpty && <option value="">— no specific step —</option>}
      {stepOptions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Note */}
      <Card icon={<StickyNote size={14} className="text-primary" />} title="Add note">
        {stepSelect(note.step_id, (v) => setNote({ ...note, step_id: v }), true)}
        <textarea
          value={note.text}
          onChange={(e) => setNote({ ...note, text: e.target.value })}
          placeholder="What did you observe?"
          rows={3}
          className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px]"
        />
        <FooterButton onClick={submitNote} busy={busy === 'note'} label="Save note" />
      </Card>

      {/* Measurement */}
      <Card icon={<Ruler size={14} className="text-primary" />} title="Record measurement">
        {stepSelect(meas.step_id, (v) => setMeas({ ...meas, step_id: v }))}
        <div className="grid grid-cols-3 gap-2">
          <input
            value={meas.key}
            onChange={(e) => setMeas({ ...meas, key: e.target.value })}
            placeholder="key (pH)"
            className="bg-zinc-900 border border-border rounded-lg px-2 py-1.5 text-[13px] font-mono"
          />
          <input
            value={meas.value}
            onChange={(e) => setMeas({ ...meas, value: e.target.value })}
            placeholder="value (7.42)"
            className="bg-zinc-900 border border-border rounded-lg px-2 py-1.5 text-[13px] font-mono"
          />
          <input
            value={meas.units}
            onChange={(e) => setMeas({ ...meas, units: e.target.value })}
            placeholder="units (pH)"
            className="bg-zinc-900 border border-border rounded-lg px-2 py-1.5 text-[13px] font-mono"
          />
        </div>
        <FooterButton onClick={submitMeasurement} busy={busy === 'meas'} label="Save measurement" />
      </Card>

      {/* Deviation */}
      <Card icon={<AlertTriangle size={14} className="text-amber-400" />} title="Log deviation">
        <div className="grid grid-cols-2 gap-2">
          {stepSelect(dev.step_id, (v) => setDev({ ...dev, step_id: v }), true)}
          <select
            value={dev.severity}
            onChange={(e) =>
              setDev({ ...dev, severity: e.target.value as (typeof SEVERITIES)[number] })
            }
            className="bg-zinc-900 border border-border rounded-lg px-2 py-1.5 text-[12px] capitalize"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <input
          value={dev.title}
          onChange={(e) => setDev({ ...dev, title: e.target.value })}
          placeholder="Short title"
          className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[13px]"
        />
        <textarea
          value={dev.description}
          onChange={(e) => setDev({ ...dev, description: e.target.value })}
          placeholder="What happened?"
          rows={3}
          className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px]"
        />
        <FooterButton
          onClick={submitDeviation}
          busy={busy === 'dev'}
          label="Log deviation"
          className="bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
        />
      </Card>

      {/* Timer */}
      <Card icon={<Timer size={14} className="text-primary" />} title="Start timer">
        {stepSelect(timer.step_id, (v) => setTimer({ ...timer, step_id: v }), true)}
        <input
          value={timer.label}
          onChange={(e) => setTimer({ ...timer, label: e.target.value })}
          placeholder="Timer label"
          className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[13px]"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0.1}
            step={0.5}
            value={timer.minutes}
            onChange={(e) => setTimer({ ...timer, minutes: Number(e.target.value) })}
            className="w-24 bg-zinc-900 border border-border rounded-lg px-2 py-1.5 text-[13px] font-mono"
          />
          <span className="text-[12px] text-muted-foreground">minutes</span>
        </div>
        <FooterButton onClick={submitTimer} busy={busy === 'timer'} label="Start timer" />
      </Card>

      {/* Ask AI */}
      <Card icon={<Sparkles size={14} className="text-primary" />} title="Ask AI" wide>
        {stepSelect(ask.step_id, (v) => setAsk({ ...ask, step_id: v }), true)}
        <div className="flex items-center gap-2">
          <input
            value={ask.question}
            onChange={(e) => setAsk({ ...ask, question: e.target.value })}
            placeholder="What is the right pH range for this buffer?"
            className="flex-1 bg-zinc-900 border border-border rounded-lg px-3 py-2 text-[13px]"
          />
          <button
            onClick={submitAsk}
            disabled={busy === 'ask'}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[12px] font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === 'ask' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Ask
          </button>
        </div>
        {askAnswer && (
          <div className="rounded-lg border border-border bg-zinc-950 p-3">
            <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
              {askAnswer.answer_text}
            </p>
            {askAnswer.citations.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Citations
                </p>
                {askAnswer.citations.map((c, i) => (
                  <p key={`cit-${i}`} className="text-[11px] text-muted-foreground font-mono">
                    {c.section_label || c.document_id?.slice(-8)}
                    {c.page_no ? ` p.${c.page_no}` : ''}{' '}
                    {c.quote_summary ? `— ${c.quote_summary}` : ''}
                  </p>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              confidence: <span className="font-mono">{askAnswer.confidence}</span>
            </p>
          </div>
        )}
      </Card>

      {/* Photo + vision check */}
      <Card icon={<Camera size={14} className="text-primary" />} title="Take photo + AI check" wide>
        {stepSelect(photoStepId, setPhotoStepId)}
        <input
          value={photoInstruction}
          onChange={(e) => setPhotoInstruction(e.target.value)}
          placeholder="What should the AI verify? (optional, falls back to step's visual checks)"
          className="w-full bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[13px]"
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) submitPhoto(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={busy === 'photo'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all disabled:opacity-50"
        >
          {busy === 'photo' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Upload photo + run vision check
        </button>
        {photoResult && (
          <div
            className={`rounded-lg border p-3 ${
              photoResult.result === 'pass' || photoResult.result === 'passed'
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                : 'border-red-500/30 bg-red-500/5 text-red-300'
            }`}
          >
            <p className="text-[13px] font-medium capitalize">
              {photoResult.result}{' '}
              {typeof photoResult.confidence === 'number' && (
                <span className="text-[11px] font-mono opacity-70">
                  ({Math.round(photoResult.confidence * 100)}%)
                </span>
              )}
            </p>
            {photoResult.notes && (
              <p className="text-[12px] mt-1 opacity-90 whitespace-pre-wrap">{photoResult.notes}</p>
            )}
            {photoResult.rationale && (
              <p className="text-[11px] mt-1 opacity-70">{photoResult.rationale}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
  wide,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 space-y-3 ${
        wide ? 'lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FooterButton({
  onClick,
  busy,
  label,
  className = '',
}: {
  onClick: () => void;
  busy: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onClick}
        disabled={busy}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50 border border-transparent ${className}`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : null}
        {label}
      </button>
    </div>
  );
}
