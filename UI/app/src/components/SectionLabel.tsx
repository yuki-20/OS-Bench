interface SectionLabelProps {
  text: string;
  light?: boolean;
}

export function SectionLabel({ text, light }: SectionLabelProps) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border"
      style={{
        background: light ? 'rgba(230,240,252,0.92)' : 'rgba(230,240,252,0.9)',
        borderColor: light ? 'rgba(74,141,232,0.35)' : 'rgba(74,141,232,0.28)',
        boxShadow: '0 10px 30px rgba(0,86,199,0.12)',
      }}>
      <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase"
        style={{ color: 'var(--cobalt)' }}>
        {text}
      </span>
    </div>
  );
}
