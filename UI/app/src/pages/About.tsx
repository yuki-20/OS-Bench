import { Target, Heart, Lightbulb, Users } from 'lucide-react';
import { PageHero } from '@/components/PageHero';

const VALUES = [
  { icon: Target, title: 'Runtime before chat', desc: 'The protocol graph and state machine are the product. Chat is one interface among many.' },
  { icon: Heart, title: 'Evidence before automation', desc: 'Every safety-relevant claim needs source support. No exceptions, no shortcuts.' },
  { icon: Lightbulb, title: 'Uncertainty is useful', desc: '"Cannot verify" is better than guessing. We surface uncertainty, never hide it.' },
  { icon: Users, title: 'Human review before publication', desc: 'AI can draft protocol graphs. Humans approve them. Every published version has a reviewer signature.' },
];

const TEAM = [
  { name: 'Dr. Sarah Chen', role: 'Co-Founder & CEO', focus: 'Former PI at MIT. 15 years in molecular biology protocols.' },
  { name: 'Marcus Johnson', role: 'Co-Founder & CTO', focus: 'Ex-Principal Engineer at Palantir. Distributed systems expert.' },
  { name: 'Dr. Aisha Patel', role: 'Head of Product', focus: 'Biotech product lead. Bridging lab science and software.' },
  { name: 'James Rodriguez', role: 'Head of Engineering', focus: 'Platform architect. Built systems serving 10M+ users.' },
  { name: 'Emily Nakamura', role: 'Head of AI Research', focus: 'PhD in NLP. Former Anthropic researcher on Claude alignment.' },
  { name: 'David Okafor', role: 'Head of EHS Strategy', focus: 'Certified safety professional. 20 years in lab compliance.' },
];

export default function About() {
  return (
    <div className="pt-16">
      <PageHero label="About" title="Built by scientists, for scientists" subtitle="OpenBench OS was born from frustration — with PDF SOPs that sit unread, training that relies on memory, and handovers that reconstruct events after the fact." />

      <section className="theme-section-soft py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>Our Mission</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-semibold text-white tracking-tight">Turn approved documents into executable runtime</h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Labs have approved documents — SOPs, SDSs, equipment manuals, lab policies. But the executable runtime usually does not. OpenBench OS fills that gap.
              </p>
              <p className="mt-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                We convert approved documents into a live runtime: structured protocol graphs, step-by-step execution, source-grounded Q&A, visual checkpoint verification, deviation capture, and handover reporting.
              </p>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ boxShadow: '0 0 40px rgba(0,86,199,0.15)' }}>
              <img src="/images/about-team.jpg" alt="OpenBench Team" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      <section className="theme-section py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>Values</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold text-white tracking-tight">How we build</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border p-8" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5" style={{ background: 'rgba(0,86,199,0.15)' }}>
                  <Icon size={24} style={{ color: 'var(--cobalt-light)' }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-section-soft py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>Team</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold text-white tracking-tight">The people behind the platform</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEAM.map(({ name, role, focus }) => (
              <div key={name} className="rounded-2xl border p-6" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg, var(--cobalt), var(--cobalt-light))' }}>
                  {name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{name}</h3>
                <p className="text-sm font-medium" style={{ color: 'var(--cobalt-light)' }}>{role}</p>
                <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{focus}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
