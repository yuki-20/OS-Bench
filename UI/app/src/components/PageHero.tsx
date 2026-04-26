import { type ReactNode } from 'react';
import { SectionLabel } from './SectionLabel';

interface PageHeroProps {
  label: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function PageHero({ label, title, subtitle, children }: PageHeroProps) {
  return (
    <section className="theme-section-soft relative overflow-hidden flex items-center justify-center" style={{ minHeight: '50vh' }}>
      {/* Animated gradient background */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(0,86,199,0.16) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(125,139,111,0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(0,86,199,0.06) 0%, transparent 70%)
        `,
      }} />
      {/* Flowing lines effect */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `repeating-linear-gradient(
          90deg,
          transparent,
          transparent 100px,
          rgba(0,86,199,0.03) 100px,
          rgba(0,86,199,0.03) 101px
        )`,
      }} />
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, rgba(13,14,16,0.64) 0%, rgba(13,14,16,0.22) 50%, rgba(13,14,16,0.64) 100%)',
      }} />
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center py-20">
        <SectionLabel text={label} light />
        <h1 className="mt-4 text-4xl md:text-6xl font-semibold text-white tracking-tight leading-tight">
          {title}
        </h1>
        <p className="mt-4 text-base md:text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {subtitle}
        </p>
        {children}
      </div>
    </section>
  );
}
