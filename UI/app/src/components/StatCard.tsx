import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface StatCardProps {
  number: string;
  description: string;
}

export function StatCard({ number, description }: StatCardProps) {
  const numberRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!numberRef.current || !cardRef.current) return;

    const numericValue = parseInt(number.replace(/\D/g, ''));
    const suffix = number.replace(/[0-9]/g, '');
    const obj = { val: 0 };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: cardRef.current,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });

    tl.from(cardRef.current, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    });

    tl.to(
      obj,
      {
        val: numericValue,
        duration: 1.5,
        ease: 'power2.out',
        onUpdate: () => {
          if (numberRef.current) {
            numberRef.current.textContent = Math.round(obj.val) + suffix;
          }
        },
      },
      '-=0.5'
    );

    return () => {
      tl.kill();
    };
  }, [number]);

  return (
    <div ref={cardRef} className="text-center md:text-left">
      <div
        ref={numberRef}
        className="font-mono text-5xl md:text-7xl font-medium tracking-tight"
        style={{ color: 'var(--cobalt)' }}
      >
        0
      </div>
      <div
        className="w-10 h-0.5 mt-4 mb-4 mx-auto md:mx-0"
        style={{ background: 'var(--cobalt)' }}
      />
      <p className="text-base" style={{ color: 'var(--midnight-muted)' }}>
        {description}
      </p>
    </div>
  );
}
