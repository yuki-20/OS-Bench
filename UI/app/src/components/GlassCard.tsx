import { type ReactNode } from 'react';

interface GlassCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function GlassCard({ title, children, className = '' }: GlassCardProps) {
  return (
    <div className={`glass-card-bg ${className}`} style={{ perspective: '1000px' }}>
      <div className="glass-card-edge" />
      <div className="glass-card-shine" />
      <div className="glass-card-inner">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
