import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle,
  Code2,
  FileText,
  GitBranch,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react';
import { SectionLabel } from '@/components/SectionLabel';

gsap.registerPlugin(ScrollTrigger);

const DEMO_STEPS = [
  {
    icon: FileText,
    title: 'Upload source pack',
    detail: 'Show the SOP, SDS, and equipment manual entering as one approved source pack.',
  },
  {
    icon: GitBranch,
    title: 'Compile protocol graph',
    detail: 'Show extracted steps, hazards, PPE, timers, stop rules, and citations.',
  },
  {
    icon: PlayCircle,
    title: 'Run guided execution',
    detail: 'Show the active step, timer, blocker, checkpoint, and operator confirmation.',
  },
  {
    icon: ShieldCheck,
    title: 'Export traceable handover',
    detail: 'Show the final timeline with citations, deviations, checkpoint evidence, and report output.',
  },
];

const DEMO_CHECKS = [
  { icon: CheckCircle, label: 'Every safety claim links to a source' },
  { icon: Camera, label: 'Visual checks expose uncertainty' },
  { icon: AlertTriangle, label: 'Deviation path is structured' },
  { icon: Code2, label: 'Runtime data is schema-shaped' },
];

export function TestimonialsSection() {
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
        .from('.demo-header', { y: 42, opacity: 0.82, duration: 0.8, ease: 'power2.out' })
        .from('.demo-step', { y: 34, opacity: 0.82, stagger: 0.1, duration: 0.85, ease: 'power2.out' }, '-=0.25')
        .from('.demo-check', { x: -18, opacity: 0.82, stagger: 0.07, duration: 0.65, ease: 'power2.out' }, '-=0.25')
        .from('.demo-terminal', { y: 28, opacity: 0.82, duration: 0.75, ease: 'power2.out' }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="demo" ref={sectionRef} className="theme-section-soft py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="demo-header text-center mb-12">
          <SectionLabel text="Hackathon Demo" light />
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight theme-title">
            Live walkthrough for the judges
          </h2>
          <p className="mt-4 text-base md:text-lg max-w-3xl mx-auto theme-copy">
            The final section is the click path: show the input, show the compiled graph, run a step, trigger uncertainty, and prove the run with a report.
          </p>
        </div>

        <div className="surface-glass rounded-2xl border p-5 md:p-7" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
          <div className="grid gap-4 lg:grid-cols-4">
            {DEMO_STEPS.map(({ icon: Icon, title, detail }, index) => (
              <div key={title} className="demo-step rounded-xl border p-5" style={{ background: 'rgba(8,10,13,0.62)', borderColor: 'rgba(255,255,255,0.14)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(0,86,199,0.18)' }}>
                    <Icon size={21} style={{ color: 'var(--cobalt-light)' }} />
                  </div>
                  {index < DEMO_STEPS.length - 1 && (
                    <div className="hidden h-8 w-8 items-center justify-center rounded-full border lg:flex" style={{ borderColor: 'rgba(74,141,232,0.28)', background: 'rgba(0,86,199,0.12)' }}>
                      <ArrowRight size={16} style={{ color: 'var(--cobalt-light)' }} />
                    </div>
                  )}
                </div>
                <p className="mt-5 font-mono text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>Step 0{index + 1}</p>
                <h3 className="mt-1 text-lg font-semibold theme-title">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed theme-copy">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {DEMO_CHECKS.map(({ icon: Icon, label }) => (
                <div key={label} className="demo-check rounded-xl border px-4 py-3" style={{ background: 'rgba(8,10,13,0.62)', borderColor: 'rgba(255,255,255,0.14)' }}>
                  <div className="flex items-center gap-3">
                    <Icon size={17} style={{ color: 'var(--sage-light)' }} />
                    <span className="text-sm font-semibold text-white">{label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="demo-terminal rounded-xl border p-4" style={{ background: 'rgba(0,86,199,0.09)', borderColor: 'rgba(74,141,232,0.2)' }}>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--cobalt-light)' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--sage-light)' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.32)' }} />
              </div>
              <div className="mt-4 space-y-2 font-mono text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
                <p>&gt; demo protocol_pack.upload</p>
                <p style={{ color: 'var(--cobalt-light)' }}>sources: SOP-248, SDS-A17, centrifuge-manual.pdf</p>
                <p>&gt; compile protocol_graph</p>
                <p style={{ color: 'var(--cobalt-light)' }}>graph.validated: 12 steps, 5 hazards, 3 checkpoints</p>
                <p>&gt; run step_04.photo_check</p>
                <p style={{ color: 'var(--sage-light)' }}>state: cannot_verify - needs reviewer confirmation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
