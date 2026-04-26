import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const COLUMNS = [
  {
    header: 'Product',
    links: [
      { label: 'Platform', to: '/platform' },
      { label: 'Protocol Compiler', to: '/platform' },
      { label: 'Bench Runtime', to: '/platform' },
      { label: 'AI Trace', to: '/platform' },
    ],
  },
  {
    header: 'Resources',
    links: [
      { label: 'Documentation', to: '/docs' },
      { label: 'API Reference', to: '/docs' },
      { label: 'Security', to: '/security' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    header: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Blog', to: '/blog' },
      { label: 'Contact', to: '/about' },
      { label: 'Privacy', to: '/security' },
    ],
  },
];

export function FooterSection() {
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!footerRef.current) return;
    gsap.from(footerRef.current.querySelector('.footer-content'), {
      y: 30, opacity: 0, duration: 0.6, ease: 'power3.out',
      scrollTrigger: { trigger: footerRef.current, start: 'top 90%' },
    });
  }, []);

  return (
    <footer ref={footerRef} className="relative z-10" style={{ background: 'rgba(8,9,11,0.82)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(18px)' }}>
      <div className="footer-content max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          {/* Brand */}
          <div className="md:w-1/3">
            <Link to="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--cobalt)' }}>
                <span className="text-white font-bold text-sm">OB</span>
              </div>
              <span className="text-lg font-semibold text-white tracking-tight">OpenBench</span>
            </Link>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Protocol runtime for modern labs. Turn approved documents into executable, verifiable, traceable workflows.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-12 md:gap-16">
            {COLUMNS.map(({ header, links }) => (
              <div key={header}>
                <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.7)' }}>{header}</h4>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {links.map(({ label, to }) => (
                    <li key={label + to}>
                      <Link
                        to={to}
                        className="text-sm transition-colors duration-200 no-underline"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-10" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            &copy; 2026 OpenBench OS. All rights reserved.
          </p>
          <div className="flex gap-6">
            {['Terms', 'Privacy', 'Cookies'].map((link) => (
              <span
                key={link}
                className="text-sm transition-colors duration-200 cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
              >
                {link}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
