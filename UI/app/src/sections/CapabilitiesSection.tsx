import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AlertTriangle,
  ClipboardCheck,
  Database,
  Eye,
  FileText,
  GitBranch,
  MessageSquare,
  PlayCircle,
  Shield,
  Timer,
} from 'lucide-react';
import { SectionLabel } from '@/components/SectionLabel';

gsap.registerPlugin(ScrollTrigger);

const FLOW_NODES = [
  {
    icon: FileText,
    title: 'Approved Docs',
    detail: 'SOPs, SDSs, manuals',
    meta: 'Versioned source pack',
    output: 'Pages, tables, hazards',
    tone: 'blue',
  },
  {
    icon: Database,
    title: 'Indexed Evidence',
    detail: 'OCR, citations, versions',
    meta: 'Searchable source map',
    output: 'Page-level references',
    tone: 'sage',
  },
  {
    icon: GitBranch,
    title: 'Protocol Graph',
    detail: 'Steps, hazards, checks',
    meta: 'Schema-validated draft',
    output: 'Prerequisites and stop rules',
    tone: 'blue',
  },
  {
    icon: PlayCircle,
    title: 'Guided Runtime',
    detail: 'State, timers, blockers',
    meta: 'Operator execution state',
    output: 'Events and deviations',
    tone: 'sage',
  },
  {
    icon: ClipboardCheck,
    title: 'Audit Report',
    detail: 'Events, deviations, proof',
    meta: 'Review-ready handover',
    output: 'Timeline and citations',
    tone: 'blue',
  },
];

const CAPABILITIES = [
  {
    icon: MessageSquare,
    title: 'Source-grounded answers',
    description: 'Step questions resolve against the active protocol and source pages, keeping answers tied to the approved document pack.',
  },
  {
    icon: Eye,
    title: 'Visual checkpoint states',
    description: 'Image checks return explicit states: confirmed, missing, unclear, or cannot verify. The UI never pretends to know hidden conditions.',
  },
  {
    icon: AlertTriangle,
    title: 'Deviation capture',
    description: 'Blocked steps, overrides, attachments, and operator notes stay connected to the exact run event that caused them.',
  },
  {
    icon: Shield,
    title: 'Traceable handover',
    description: 'Reviewers get a clean chain from document source to executed step, evidence, deviations, and final report.',
  },
];

const RUNTIME_EVENTS = [
  { icon: Timer, label: 'Timer started', value: '14:32 remaining' },
  { icon: Eye, label: 'Photo checkpoint', value: 'Step 04 needs review' },
  { icon: Shield, label: 'Evidence linked', value: 'SOP-248 p.12' },
];

export function CapabilitiesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 78%',
          end: 'bottom 62%',
          scrub: 0.7,
        },
      });

      timeline
        .from('.overview-header', { y: 44, opacity: 0.82, duration: 0.9, ease: 'power2.out' })
        .from('.flow-stage', { y: 42, opacity: 0.82, stagger: 0.14, duration: 0.9, ease: 'power2.out' }, '-=0.45')
        .from('.runtime-event', { x: -24, opacity: 0.82, stagger: 0.08, duration: 0.7, ease: 'power2.out' }, '-=0.35')
        .from('.overview-detail', { y: 34, opacity: 0.82, stagger: 0.08, duration: 0.8, ease: 'power2.out' }, '-=0.35');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="capabilities" ref={sectionRef} className="theme-section py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="overview-header text-center mb-12">
          <SectionLabel text="Product Overview" light />
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight theme-title">
            From documents to guided execution
          </h2>
          <p className="mt-4 text-base md:text-lg max-w-3xl mx-auto theme-copy">
            OpenBench turns approved lab documents into a working runtime: source pages become structured evidence, evidence becomes protocol state, and protocol state becomes a traceable run.
          </p>
        </div>

        <div className="product-flow surface-glass rounded-2xl border p-5 md:p-7" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
          <div className="grid gap-4 lg:grid-cols-5">
            {FLOW_NODES.map(({ icon: Icon, title, detail, meta, output, tone }, index) => (
              <div key={title} className="flow-stage relative">
                {index < FLOW_NODES.length - 1 && <div className="flow-connector hidden lg:block" />}
                <div className={`diagram-node flow-node flow-node-${tone} h-full flex-col items-start`}>
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <Icon size={21} />
                    </div>
                    <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                      0{index + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.58)' }}>{detail}</p>
                  </div>
                  <div className="mt-auto w-full space-y-2 pt-3">
                    <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.055)', color: 'rgba(255,255,255,0.68)' }}>
                      {meta}
                    </p>
                    <p className="font-mono text-[11px]" style={{ color: tone === 'blue' ? 'var(--cobalt-light)' : 'var(--sage-light)' }}>
                      {output}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {RUNTIME_EVENTS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="runtime-event flow-branch rounded-xl border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon size={17} style={{ color: 'var(--cobalt-light)' }} />
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CAPABILITIES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="overview-detail rounded-xl border p-5 transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: 'rgba(8,10,13,0.62)',
                  borderColor: 'rgba(255,255,255,0.14)',
                }}
              >
                <Icon size={21} style={{ color: 'var(--cobalt-light)' }} />
                <h3 className="mt-4 text-base font-semibold theme-title">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed theme-copy">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
