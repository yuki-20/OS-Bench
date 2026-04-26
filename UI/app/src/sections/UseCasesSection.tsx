import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  CheckCircle,
  ClipboardList,
  Eye,
  FileCheck,
  FlaskConical,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { SectionLabel } from '@/components/SectionLabel';

gsap.registerPlugin(ScrollTrigger);

const USE_CASES = [
  {
    icon: FlaskConical,
    role: 'Operator',
    title: 'Execute the active protocol',
    goal: 'Move through a run without missing prerequisites, PPE, timers, or checkpoint rules.',
    demo: 'Start Batch 17B, complete preparation steps, hit a photo checkpoint, and log a deviation when evidence is unclear.',
    artifacts: ['completed step events', 'timer history', 'photo evidence', 'deviation note'],
  },
  {
    icon: FileCheck,
    role: 'Reviewer',
    title: 'Validate the compiled graph',
    goal: 'Confirm that extracted steps, hazards, and visual checks are grounded in approved source material.',
    demo: 'Open the compiled protocol, inspect confidence and citations, edit a low-confidence field, then publish the version.',
    artifacts: ['published protocol version', 'source citations', 'review edits', 'confidence exceptions'],
  },
  {
    icon: ShieldAlert,
    role: 'Safety Lead',
    title: 'Control unsafe or uncertain states',
    goal: 'Focus on unresolved checkpoints, overrides, missing evidence, and high-severity deviations.',
    demo: 'Review a cannot-verify photo check, require a retake or supervisor approval, and record the safety decision.',
    artifacts: ['override decision', 'checkpoint status', 'severity label', 'escalation trail'],
  },
  {
    icon: Users,
    role: 'Lab Manager',
    title: 'Read the handover without replaying chat',
    goal: 'Understand what happened in a run from structured events and evidence, not screenshots or memory.',
    demo: 'Open the final handover, scan the timeline, inspect deviations, and export the audit-ready report.',
    artifacts: ['handover report', 'run timeline', 'deviation summary', 'evidence index'],
  },
];

const HANDOFF_STEPS = [
  { icon: ClipboardList, label: 'Protocol compiled', detail: 'source pack becomes graph' },
  { icon: Eye, label: 'Execution verified', detail: 'runtime state records evidence' },
  { icon: FileCheck, label: 'Handover ready', detail: 'events become report' },
];

export function UseCasesSection() {
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
        .from('.usecase-header', { y: 42, opacity: 0.82, duration: 0.8, ease: 'power2.out' })
        .from('.handoff-step', { y: 26, opacity: 0.82, stagger: 0.12, duration: 0.7, ease: 'power2.out' }, '-=0.25')
        .from('.usecase-card', { y: 36, opacity: 0.82, stagger: 0.08, duration: 0.85, ease: 'power2.out' }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="use-cases" ref={sectionRef} className="theme-section-soft py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="usecase-header text-center mb-10">
          <SectionLabel text="Use Cases" light />
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight theme-title">
            Four demo roles, one protocol state
          </h2>
          <p className="mt-4 text-base md:text-lg max-w-3xl mx-auto theme-copy">
            The story for the judge is simple: the same run moves from source review to bench execution, safety escalation, and final handover.
          </p>
        </div>

        <div className="surface-glass rounded-2xl border p-5 md:p-7" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            {HANDOFF_STEPS.map(({ icon: Icon, label, detail }, index) => (
              <div
                key={label}
                className="handoff-step rounded-xl border px-4 py-3"
                style={{
                  background: 'rgba(8,10,13,0.62)',
                  borderColor: 'rgba(255,255,255,0.15)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} style={{ color: index === 1 ? 'var(--sage-light)' : 'var(--cobalt-light)' }} />
                  <div>
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>{detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="usecase-grid grid gap-4 md:grid-cols-2">
            {USE_CASES.map(({ icon: Icon, role, title, goal, demo, artifacts }) => (
              <div
                key={role}
                className="usecase-card rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: 'rgba(8,10,13,0.66)',
                  borderColor: 'rgba(255,255,255,0.14)',
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(0,86,199,0.18)' }}>
                    <Icon size={21} style={{ color: 'var(--cobalt-light)' }} />
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--cobalt-pale)', color: 'var(--cobalt)' }}>
                    {role}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-semibold theme-title">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed theme-copy">{goal}</p>

                <div className="mt-4 rounded-xl border p-4" style={{ background: 'rgba(0,86,199,0.16)', borderColor: 'rgba(74,141,232,0.3)' }}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--cobalt-light)' }}>
                    Demo moment
                  </p>
                  <p className="mt-2 text-sm leading-relaxed theme-copy-strong">{demo}</p>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {artifacts.map((artifact) => (
                    <div key={artifact} className="flex items-start gap-2">
                      <CheckCircle size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--sage-light)' }} />
                      <span className="text-sm theme-copy-strong">{artifact}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
