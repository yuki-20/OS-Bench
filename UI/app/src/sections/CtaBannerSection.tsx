import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PrimaryButton } from '@/components/Buttons';

gsap.registerPlugin(ScrollTrigger);

export function CtaBannerSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sectionRef.current) return;

    const children = sectionRef.current.querySelectorAll('.cta-animate');
    gsap.from(children, {
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="theme-section-deep py-20 md:py-28"
      style={{
        background: 'linear-gradient(135deg, rgba(13,14,16,0.88), rgba(28,30,33,0.76))',
      }}
    >
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="cta-animate text-3xl md:text-5xl font-semibold text-white tracking-tight">
          Ready to transform your lab execution?
        </h2>
        <p className="cta-animate mt-4 text-base md:text-lg" style={{ color: 'rgba(255,255,255,0.8)' }}>
          See how OpenBench OS turns your lab documents into guided, verifiable, traceable protocol runtime.
        </p>
        <div className="cta-animate mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <PrimaryButton onClick={() => navigate('/signup')}>Get Started</PrimaryButton>
        </div>
        <p className="cta-animate mt-8 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          SOC 2 ready. Setup in minutes.
        </p>
      </div>
    </section>
  );
}
