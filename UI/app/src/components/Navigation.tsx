import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Menu, X } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from './Buttons';

gsap.registerPlugin(ScrollTrigger);

const NAV_LINKS = [
  { label: 'Overview', sectionId: 'capabilities' },
  { label: 'Features', sectionId: 'features' },
  { label: 'Use Cases', sectionId: 'use-cases' },
  { label: 'Demo', sectionId: 'demo' },
  { label: 'Architecture', sectionId: 'architecture' },
];

export function Navigation() {
  const navRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  const scrollToSection = (sectionId: string, attempt = 0) => {
    const section = document.getElementById(sectionId);

    if (!section) {
      if (attempt < 12) {
        window.setTimeout(() => scrollToSection(sectionId, attempt + 1), 50);
      }
      return;
    }

    const top = section.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: 'smooth' });
    window.setTimeout(() => ScrollTrigger.refresh(), 250);
  };

  const handleSectionClick = (sectionId: string) => {
    setMobileOpen(false);

    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => scrollToSection(sectionId), 80);
      return;
    }

    scrollToSection(sectionId);
  };

  const handleAuthLinkClick = () => {
    setMobileOpen(false);
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill(true));
    if (navRef.current) {
      gsap.set(navRef.current, { opacity: 1, y: 0 });
    }
  };

  useEffect(() => {
    if (!navRef.current) return;
    let heroTrigger: ScrollTrigger | undefined;

    if (isHome) {
      gsap.set(navRef.current, { opacity: 0, y: -20 });

      heroTrigger = ScrollTrigger.create({
        trigger: '#hero',
        start: 'bottom top',
        onEnter: () => {
          gsap.to(navRef.current, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
        },
        onLeaveBack: () => {
          gsap.to(navRef.current, { opacity: 0, y: -20, duration: 0.3 });
        },
      });
    } else {
      gsap.set(navRef.current, { opacity: 1, y: 0 });
    }

    return () => {
      heroTrigger?.kill();
    };
  }, [isHome]);

  return (
    <>
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: 'rgba(13,14,16,0.74)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          opacity: isHome ? 0 : 1,
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--cobalt)' }}>
              <span className="text-white font-bold text-sm">OB</span>
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--cobalt)' }}>
              OpenBench
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <button
                key={link.sectionId}
                type="button"
                className="text-sm font-medium transition-colors duration-200 cursor-pointer"
                style={{
                  color: 'rgba(255,255,255,0.68)',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
                onClick={() => handleSectionClick(link.sectionId)}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.68)'; }}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA + Mobile Menu */}
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="hidden md:block no-underline" onClick={handleAuthLinkClick}>
              <SecondaryButton white className="!px-5 !py-2.5 !text-sm">Dashboard</SecondaryButton>
            </Link>
            <Link to="/signup" className="hidden md:block no-underline" onClick={handleAuthLinkClick}>
              <PrimaryButton className="!px-5 !py-2.5 !text-sm">Create account</PrimaryButton>
            </Link>
            <button className="md:hidden p-2 cursor-pointer text-white" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 p-6 shadow-xl" style={{ background: 'rgba(13,14,16,0.95)', borderLeft: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(18px)' }}>
            <button className="absolute top-4 right-4 p-2 cursor-pointer text-white" onClick={() => setMobileOpen(false)}>
              <X size={24} />
            </button>
            <div className="mt-12 flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.sectionId}
                  type="button"
                  className="text-left text-lg font-medium py-2 cursor-pointer"
                  style={{
                    color: 'rgba(255,255,255,0.78)',
                    background: 'transparent',
                    border: 'none',
                  }}
                  onClick={() => handleSectionClick(link.sectionId)}
                >
                  {link.label}
                </button>
              ))}
              <Link
                to="/about"
                className="text-lg font-medium py-2 no-underline"
                style={{ color: location.pathname === '/about' ? 'var(--cobalt-light)' : 'rgba(255,255,255,0.78)' }}
                onClick={() => setMobileOpen(false)}
              >
                About
              </Link>
              <div className="mt-4">
                <Link to="/dashboard" className="block no-underline" onClick={handleAuthLinkClick}>
                  <SecondaryButton white className="w-full">Dashboard</SecondaryButton>
                </Link>
                <Link to="/signup" className="mt-3 block no-underline" onClick={handleAuthLinkClick}>
                  <PrimaryButton className="w-full">Create account</PrimaryButton>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
