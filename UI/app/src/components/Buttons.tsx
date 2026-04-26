import { type ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  inverted?: boolean;
  white?: boolean;
  className?: string;
}

export function PrimaryButton({ children, onClick, inverted, className = '' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-7 py-3.5 rounded-lg font-semibold text-base transition-all duration-250 cursor-pointer ${className}`}
      style={{
        background: inverted ? 'white' : 'var(--cobalt)',
        color: inverted ? 'var(--cobalt)' : 'white',
        border: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = inverted
          ? '0 8px 32px rgba(255,255,255,0.2)'
          : 'var(--shadow-cobalt)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, white, className = '' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-7 py-3.5 rounded-lg font-semibold text-base transition-all duration-250 cursor-pointer ${className}`}
      style={{
        background: white ? 'rgba(255,255,255,0.1)' : 'rgba(0,86,199,0.12)',
        color: white ? 'white' : 'var(--cobalt)',
        border: white ? '1.5px solid rgba(255,255,255,0.58)' : '1.5px solid rgba(0,86,199,0.34)',
        backdropFilter: 'blur(14px)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.background = white
          ? 'rgba(255,255,255,0.1)'
          : 'var(--cobalt)';
        e.currentTarget.style.color = 'white';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = white ? 'rgba(255,255,255,0.1)' : 'rgba(0,86,199,0.12)';
        e.currentTarget.style.color = white ? 'white' : 'var(--cobalt)';
      }}
    >
      {children}
    </button>
  );
}
