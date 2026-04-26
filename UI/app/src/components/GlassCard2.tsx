import { type ReactNode } from 'react';

interface GlassCard2Props {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard2({ children, className = '', hover = true }: GlassCard2Props) {
  return (
    <div
      className={`glass-card-bg ${className}`}
      style={{
        position: 'relative',
        borderRadius: '16px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Inner edge highlight */}
      <div
        style={{
          position: 'absolute',
          inset: '1px',
          borderRadius: '15px',
          border: '1px solid rgba(255,255,255,0.03)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Sheen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
          backgroundSize: '200% 200%',
          animation: 'sheen 8s ease-in-out infinite',
          pointerEvents: 'none',
          mixBlendMode: 'overlay' as const,
          zIndex: 1,
        }}
      />
      {/* Content */}
      <div className={`relative z-10 ${hover ? 'h-full' : ''}`}>
        {children}
      </div>
    </div>
  );
}
