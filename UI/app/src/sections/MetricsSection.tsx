import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SectionLabel } from '@/components/SectionLabel';

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { number: '85%', description: 'Protocol extraction accuracy against golden labels' },
  { number: '100%', description: 'Safety-critical claims with source citations' },
  { number: '0', description: 'Unsupported operator-facing claims in safety-critical flows' },
  { number: '95%', description: 'Runs bound to published protocol versions' },
];

export function MetricsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const cards = sectionRef.current!.querySelectorAll('.stat-item');
      const numbers = sectionRef.current!.querySelectorAll('.stat-number');

      gsap.from(cards, {
        y: 34,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 78%',
          end: 'bottom 65%',
          scrub: 0.7,
        },
      });

      numbers.forEach((el) => {
        const text = el.textContent || '0';
        const numericValue = parseInt(text.replace(/\D/g, ''));
        const suffix = text.replace(/[0-9]/g, '');
        const obj = { val: 0 };

        gsap.to(obj, {
          val: numericValue,
          duration: 1.5,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = Math.round(obj.val) + suffix;
          },
          scrollTrigger: { trigger: el, start: 'top 85%' },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="theme-section-soft py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <SectionLabel text="Impact Metrics" light />
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-white tracking-tight">
            Built for real lab outcomes
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(({ number, description }) => (
            <div
              key={description}
              className="stat-item rounded-2xl border p-5 text-center md:text-left"
              style={{
                background: 'rgba(255,255,255,0.045)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="stat-number font-mono text-4xl md:text-5xl font-medium tracking-tight"
                style={{ color: 'var(--cobalt)' }}
              >
                {number}
              </div>
              <div className="w-10 h-0.5 mt-4 mb-4 mx-auto md:mx-0" style={{ background: 'var(--cobalt)' }} />
              <p className="text-base theme-muted">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
