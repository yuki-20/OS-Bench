import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Shield, CheckCircle } from 'lucide-react';
import { SectionLabel } from '@/components/SectionLabel';
import { GlassCard } from '@/components/GlassCard';
import { SecondaryButton } from '@/components/Buttons';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const trustRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !headlineRef.current || !subtitleRef.current) return;

    const ctx = gsap.context(() => {
      const splitHeadline = new SplitText(headlineRef.current, { type: 'words' });
      const splitSubtitle = new SplitText(subtitleRef.current, { type: 'chars' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=300%',
          pin: true,
          scrub: 0.5,
        },
      });

      // Phase 1: Title entrance (0% to 15%)
      tl.fromTo(
        eyebrowRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, ease: 'power2.out' },
        0
      );

      tl.fromTo(
        splitHeadline.words,
        { opacity: 0, yPercent: 60 },
        { opacity: 1, yPercent: 0, stagger: 0.02, ease: 'power3.out' },
        0.02
      );

      tl.fromTo(
        splitSubtitle.chars,
        { opacity: 0 },
        { opacity: 1, stagger: 0.003, ease: 'none' },
        0.05
      );

      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, ease: 'power2.out' },
        0.1
      );

      tl.fromTo(
        trustRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, ease: 'power2.out' },
        0.12
      );

      // Phase 2: Cards flip in (15% to 30%)
      tl.fromTo(
        cardsRef.current?.children || [],
        { rotationX: 45, z: -200, opacity: 0 },
        { rotationX: 0, z: 0, opacity: 1, stagger: 0.02, ease: 'back.out(1.2)' },
        0.15
      );

      // Phase 3: Hold (30% to 70%) - nothing changes

      // Phase 4: Exit (70% to 100%)
      tl.to(
        cardsRef.current?.children || [],
        { opacity: 0, scale: 0.85, y: -60, ease: 'power2.in' },
        0.7
      );

      tl.to(
        contentRef.current,
        { opacity: 0, y: -40, ease: 'power2.in' },
        0.75
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: '100vh' }}
    >
      {/* Dark Gradient Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(28,30,33,0.85) 0%, rgba(28,30,33,0.6) 50%, rgba(28,30,33,0.85) 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Content Layer */}
      <div
        ref={contentRef}
        className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-20"
      >
        <div ref={eyebrowRef} className="mb-6">
          <SectionLabel text="OpenBench OS Protocol Runtime" />
        </div>

        <h1
          ref={headlineRef}
          className="text-4xl md:text-6xl lg:text-7xl font-semibold text-white text-center max-w-4xl leading-tight tracking-tight"
        >
          Turn lab documents into{' '}
          <span style={{ color: 'var(--cobalt)' }}>executable runtime</span>
        </h1>

        <p
          ref={subtitleRef}
          className="mt-6 text-base md:text-lg text-center max-w-2xl leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          The protocol execution platform that compiles SOPs, SDSs, and equipment manuals into step-by-step guided workflows with AI-powered verification and complete traceability.
        </p>

        <div ref={ctaRef} className="mt-10 flex flex-col sm:flex-row gap-4">
          <SecondaryButton white>Watch Demo</SecondaryButton>
        </div>

        <div ref={trustRef} className="mt-8 flex flex-wrap justify-center gap-4">
          {[
            { icon: Shield, text: 'SOC 2 Ready' },
            { icon: CheckCircle, text: 'AI-Verified' },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <Icon size={16} style={{ color: 'var(--cobalt-light)' }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {text}
              </span>
            </div>
          ))}
        </div>

        {/* Glass Cards */}
        <div
          ref={cardsRef}
          className="mt-12 md:mt-16 flex flex-col md:flex-row gap-6 items-center justify-center"
          style={{ perspective: '1000px' }}
        >
          <GlassCard title="Bench Runtime Client" className="w-[340px] md:w-[380px]">
            <div className="rounded-lg overflow-hidden">
              <img
                src="/images/hero-runtime-card.jpg"
                alt="Bench Runtime Interface"
                className="w-full h-auto rounded-lg"
              />
            </div>
          </GlassCard>
          <div className="hidden md:block">
            <GlassCard title="Protocol Compiler" className="w-[380px]">
              <div className="rounded-lg overflow-hidden">
                <img
                  src="/images/hero-compiler-card.jpg"
                  alt="Protocol Compiler Visualization"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  );
}
