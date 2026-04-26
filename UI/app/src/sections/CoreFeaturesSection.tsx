import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  FileText,
  GitBranch,
  Layers,
  MessageSquare,
  ShieldCheck,
  Timer,
  Users,
  Zap,
} from 'lucide-react';
import { SectionLabel } from '@/components/SectionLabel';

gsap.registerPlugin(ScrollTrigger);

const FEATURE_GROUPS = [
  {
    icon: GitBranch,
    title: 'Protocol Compiler',
    summary: 'Converts SOPs, SDSs, manuals, and policies into a typed execution graph.',
    artifact: 'protocol_graph.json',
    points: ['Ordered steps with prerequisites', 'PPE and hazard mapping', 'Stop conditions and blockers', 'Page-level source citations'],
  },
  {
    icon: Layers,
    title: 'Run State Engine',
    summary: 'Keeps each active run deterministic instead of acting like a free-form checklist.',
    artifact: 'run_state.eventlog',
    points: ['Current step and completion state', 'Timers, notes, and blockers', 'Pause, resume, complete, override', 'Immutable event timeline'],
  },
  {
    icon: Camera,
    title: 'Visual Checkpoints',
    summary: 'Verifies visible bench conditions without claiming hidden facts.',
    artifact: 'checkpoint_assessment',
    points: ['Confirmed, missing, unclear states', 'Cannot-verify as a valid result', 'Retake and reviewer review flows', 'Photo evidence attached to step'],
  },
  {
    icon: MessageSquare,
    title: 'Step Q&A',
    summary: 'Answers operator questions only inside the active step and approved source context.',
    artifact: 'cited_answer',
    points: ['Grounded in active protocol version', 'Source citations shown with answer', 'Confidence and refusal states', 'Escalates unclear safety questions'],
  },
  {
    icon: AlertTriangle,
    title: 'Deviation Handling',
    summary: 'Captures exceptions as structured events, not as hidden notes.',
    artifact: 'deviation_record',
    points: ['Severity and reason capture', 'Attachment and comment trail', 'Role-based override review', 'Resolution linked to run step'],
  },
  {
    icon: ShieldCheck,
    title: 'AI Trace Panel',
    summary: 'Shows why the system made a claim, refused one, or flagged uncertainty.',
    artifact: 'ai_trace',
    points: ['Task type and model metadata', 'Source list and schema status', 'Safety critic result', 'Confidence and reviewer focus'],
  },
  {
    icon: FileText,
    title: 'Handover Report',
    summary: 'Builds a report from run events so judges can inspect what happened.',
    artifact: 'handover_report.pdf',
    points: ['Step timeline', 'Deviations and overrides', 'Photo checkpoint evidence', 'Source citation appendix'],
  },
  {
    icon: Users,
    title: 'Role Views',
    summary: 'Shows the same runtime state differently for operator, reviewer, safety, and manager users.',
    artifact: 'role_permissions',
    points: ['Operator execution view', 'Reviewer approval queue', 'Safety escalation panel', 'Manager handover summary'],
  },
];

const RUNTIME_ROWS = [
  { icon: FileText, label: 'Compile SOP-248', state: '12 steps, 5 hazards, 3 visual checks', status: 'complete' },
  { icon: Timer, label: 'Run Batch 17B', state: 'step timer active, prerequisite satisfied', status: 'live' },
  { icon: Camera, label: 'Photo Check 04', state: 'secondary containment unclear', status: 'review' },
  { icon: AlertTriangle, label: 'Deviation D-019', state: 'operator note attached to step event', status: 'logged' },
  { icon: Users, label: 'Supervisor Override', state: 'approval required before continuing', status: 'blocked' },
];

export function CoreFeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 78%',
          end: 'bottom 58%',
          scrub: 0.75,
        },
      });

      timeline
        .from('.features-header', { y: 44, opacity: 0.82, duration: 0.8, ease: 'power2.out' })
        .from('.runtime-row', { x: -28, opacity: 0.82, stagger: 0.08, duration: 0.75, ease: 'power2.out' }, '-=0.25')
        .from('.feature-card', { y: 34, opacity: 0.82, stagger: 0.06, duration: 0.85, ease: 'power2.out' }, '-=0.25');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="theme-section py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="features-header grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <SectionLabel text="Features" light />
            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight theme-title">
              Features judges can inspect
            </h2>
          </div>
          <p className="text-base md:text-lg leading-relaxed theme-copy">
            Each feature maps to a real demo artifact. The judge should be able to ask: where did this instruction come from, what state changed, and what evidence proves it?
          </p>
        </div>

        <div className="surface-glass mt-10 rounded-2xl border p-5 md:p-7" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.08em]" style={{ color: 'var(--cobalt-light)' }}>
                    Runtime Feed
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">Live protocol state</h3>
                </div>
                <Zap size={22} style={{ color: 'var(--cobalt-light)' }} />
              </div>

              <div className="mt-6 space-y-3">
                {RUNTIME_ROWS.map(({ icon: Icon, label, state, status }) => (
                  <div
                    key={label}
                    className="runtime-row rounded-xl border px-4 py-3"
                    style={{
                      background: 'rgba(8,10,13,0.62)',
                      borderColor: 'rgba(255,255,255,0.14)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={17} style={{ color: status === 'blocked' ? 'var(--sage-light)' : 'var(--cobalt-light)' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>{state}</p>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase"
                        style={{
                          background: status === 'live' ? 'rgba(0,86,199,0.22)' : 'rgba(255,255,255,0.07)',
                          color: status === 'blocked' ? 'var(--sage-light)' : 'var(--cobalt-light)',
                        }}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="feature-grid grid gap-4 md:grid-cols-2">
              {FEATURE_GROUPS.map(({ icon: Icon, title, summary, artifact, points }) => (
                <div
                  key={title}
                  className="feature-card rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: 'rgba(8,10,13,0.62)',
                    borderColor: 'rgba(255,255,255,0.14)',
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(0,86,199,0.18)' }}>
                      <Icon size={21} style={{ color: 'var(--cobalt-light)' }} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold theme-title">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed theme-copy">{summary}</p>
                      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--cobalt-light)' }}>{artifact}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {points.map((point) => (
                      <div key={point} className="flex items-start gap-2">
                        <CheckCircle size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--sage-light)' }} />
                        <span className="text-sm theme-copy-strong">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
