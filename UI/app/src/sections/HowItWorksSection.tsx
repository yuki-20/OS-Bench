import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SectionLabel } from '@/components/SectionLabel';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    number: 'STEP 01',
    title: 'Upload your document pack',
    description:
      'Upload SOPs, SDSs, equipment manuals, and lab policies. The system classifies each document, runs OCR when needed, and preserves page-level source references for complete traceability.',
    image: '/images/how-step-1.jpg',
  },
  {
    number: 'STEP 02',
    title: 'Review the compiled protocol',
    description:
      'The Protocol Compiler generates a structured graph with ordered steps, hazards, PPE requirements, and visual checkpoints. Reviewers inspect extraction confidence, edit drafts, and publish immutable protocol versions.',
    image: '/images/how-step-2.jpg',
  },
  {
    number: 'STEP 03',
    title: 'Execute with guided runtime',
    description:
      'Operators follow step-by-step instructions through the Bench Runtime Client. The run engine enforces prerequisites, manages timers, captures notes and deviations, and blocks progress when critical checkpoints are unresolved.',
    image: '/images/how-step-3.jpg',
  },
  {
    number: 'STEP 04',
    title: 'Generate handover from events',
    description:
      'When the run completes, the system generates a structured handover report from the event log — not from chat memory. Every deviation, timer, photo assessment, and source citation is preserved for review and audit.',
    image: '/images/how-step-4.jpg',
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const steps = sectionRef.current.querySelectorAll('.step-item');
    steps.forEach((step, index) => {
      const text = step.querySelector('.step-text');
      const image = step.querySelector('.step-image');
      const isEven = index % 2 === 0;

      gsap.from(text, {
        x: isEven ? -40 : 40,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 75%' },
      });

      gsap.from(image, {
        x: isEven ? 40 : -40,
        opacity: 0,
        duration: 0.8,
        delay: 0.15,
        ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 75%' },
      });
    });
  }, []);

  return (
    <section id="how-it-works" ref={sectionRef} className="theme-section-soft py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <SectionLabel text="How It Works" light />
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight theme-title">
            From upload to execution in four steps
          </h2>
        </div>

        <div className="flex flex-col gap-24">
          {STEPS.map((step, index) => (
            <div
              key={step.number}
              className={`step-item flex flex-col md:flex-row items-center gap-12 ${
                index % 2 === 1 ? 'md:flex-row-reverse' : ''
              }`}
            >
              <div className="step-text md:w-1/2">
                <span
                  className="font-mono text-xs font-medium tracking-[0.08em]"
                  style={{ color: 'var(--cobalt)' }}
                >
                  {step.number}
                </span>
                <h3 className="mt-2 text-2xl md:text-3xl font-semibold theme-title">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed theme-copy">
                  {step.description}
                </p>
              </div>
              <div className="step-image md:w-1/2">
                <div className="rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
