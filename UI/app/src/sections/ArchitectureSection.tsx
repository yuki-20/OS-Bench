import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Monitor, Globe, Zap, Layers, Shield, Server, Database, Activity, FileCheck, Cpu } from 'lucide-react';
import { SectionLabel } from '@/components/SectionLabel';

gsap.registerPlugin(ScrollTrigger);

const TECH_CARDS = [
  {
    icon: Monitor,
    title: 'Windows-First Desktop',
    description: 'Installable Bench Runtime Client built with Tauri 2 and shared React UI for controlled bench execution.',
  },
  {
    icon: Globe,
    title: 'Web Control Console',
    description: 'Browser-based admin surface for protocol review, run oversight, team management, and audit access.',
  },
  {
    icon: Zap,
    title: 'Cloud AI Services',
    description: 'FastAPI backend with document ingestion, protocol compilation, vision checkpoint, and report generation pipelines.',
  },
  {
    icon: Layers,
    title: 'Event Sourcing',
    description: 'Every action is an immutable event: run_created, step_completed, deviation_added, photo_assessed.',
  },
  {
    icon: Shield,
    title: 'Security & Compliance',
    description: 'TLS in transit, encryption at rest, role-based access control, database-enforced row isolation, and audit logging.',
  },
];

const ARCH_TIERS = [
  {
    label: 'Client Layer',
    nodes: [
      { icon: Monitor, title: 'Desktop Runtime' },
      { icon: Globe, title: 'Web Console' },
    ],
  },
  {
    label: 'Gateway Layer',
    nodes: [
      { icon: Server, title: 'API Gateway' },
    ],
  },
  {
    label: 'Core Services',
    nodes: [
      { icon: FileCheck, title: 'Protocol' },
      { icon: Activity, title: 'Run Engine' },
      { icon: Layers, title: 'Reports' },
    ],
  },
  {
    label: 'AI Workers',
    nodes: [
      { icon: Cpu, title: 'Parsing' },
      { icon: GitBranchIcon, title: 'Compilation' },
      { icon: Zap, title: 'Vision' },
    ],
  },
  {
    label: 'Persistence',
    nodes: [
      { icon: Database, title: 'Database' },
      { icon: Shield, title: 'Audit Store' },
    ],
  },
];

function GitBranchIcon({ size = 18 }: { size?: number }) {
  return <Layers size={size} />;
}

function ArchitectureDiagram() {
  return (
    <div className="architecture-map surface-glass mb-16 rounded-2xl border p-5 md:p-8">
      <div className="relative">
        <div className="data-pulse data-pulse-one" />
        <div className="data-pulse data-pulse-two" />

        {ARCH_TIERS.map((tier, tierIndex) => (
          <div key={tier.label} className="arch-tier" style={{ animationDelay: `${tierIndex * 120}ms` }}>
            <div className="arch-tier-label">{tier.label}</div>
            <div className="arch-node-row">
              {tier.nodes.map(({ icon: Icon, title }, nodeIndex) => (
                <div key={title} className="diagram-node arch-node" style={{ animationDelay: `${tierIndex * 120 + nodeIndex * 80}ms` }}>
                  <Icon size={18} />
                  <span>{title}</span>
                </div>
              ))}
            </div>
            {tierIndex < ARCH_TIERS.length - 1 && <div className="arch-downlink" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArchitectureSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const diagram = sectionRef.current.querySelector('.architecture-map');
    const cards = sectionRef.current.querySelectorAll('.tech-card');

    gsap.from(diagram, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: diagram, start: 'top 80%' },
    });

    gsap.from(cards, {
      y: 50,
      opacity: 0,
      duration: 0.7,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current.querySelector('.tech-grid'), start: 'top 80%' },
    });
  }, []);

  return (
    <section id="architecture" ref={sectionRef} className="theme-section-soft py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <SectionLabel text="Technical Architecture" light />
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight theme-title">
            Built for enterprise lab operations
          </h2>
          <p className="mt-4 text-base max-w-2xl mx-auto theme-copy">
            Multi-surface platform with a desktop runtime, web control console, AI services, event sourcing, and auditable persistence.
          </p>
        </div>

        <ArchitectureDiagram />

        <div className="tech-grid grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TECH_CARDS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="tech-card surface-glass rounded-xl p-6 border transition-all duration-250"
              style={{ borderColor: 'rgba(255,255,255,0.11)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.075)';
                e.currentTarget.style.boxShadow = '0 22px 60px rgba(0,86,199,0.14)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              <Icon size={20} style={{ color: 'var(--cobalt-light)' }} />
              <h3 className="mt-3 text-base font-semibold theme-title">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed theme-copy">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
