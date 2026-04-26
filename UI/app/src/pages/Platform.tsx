import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileText, GitBranch, Shield, Play, MessageSquare, Camera, AlertTriangle, FileOutput, Zap, Users, Bell, Plug } from 'lucide-react';
import { PageHero } from '@/components/PageHero';

gsap.registerPlugin(ScrollTrigger);

const MODULES = [
  { icon: FileText, title: 'Document Ingestion', desc: 'Ingest PDFs, DOCX, and images. Classify, parse, index with OCR fallback and page-level source references.', features: ['PDF & DOCX', 'OCR fallback', 'Page citations', 'Version labels'] },
  { icon: GitBranch, title: 'Protocol Compiler', desc: 'Transform documents into structured protocol graphs with steps, hazards, PPE, visual checks, and stop conditions.', features: ['Step extraction', 'Hazard ID', 'PPE mapping', 'Confidence scores'] },
  { icon: Shield, title: 'Hazard Mapping', desc: 'Map SDS and policy material to step-level safety requirements with incompatibility detection.', features: ['SDS parsing', 'PPE extraction', 'Incompatibility', 'Escalation triggers'] },
  { icon: Play, title: 'Run Engine', desc: 'Deterministic core. Create runs, persist state, enforce blockers, manage timers, pause/resume.', features: ['State machine', 'Blockers', 'Timers', 'Overrides'] },
  { icon: MessageSquare, title: 'Step Q&A', desc: 'Contextual Q&A scoped to current step. Source-grounded answers with citations and confidence.', features: ['Source answers', 'Citations', 'Confidence', 'Escalation'] },
  { icon: Camera, title: 'Vision Checkpoint', desc: 'Photo verification against step-specific visual checklists. No hidden-state guessing.', features: ['Checklists', 'Visible only', 'Retake flow', 'Evidence persist'] },
  { icon: AlertTriangle, title: 'Deviation & Override', desc: 'Log deviations with severity, attachments, resolution. Role-based override approval.', features: ['Severity', 'Attachments', 'Resolution', 'Audit trail'] },
  { icon: FileOutput, title: 'Handover & Audit', desc: 'Generate structured reports from events — not chat memory. Timeline, deviations, photo evidence.', features: ['Event reports', 'Timeline', 'Photo index', 'Citations'] },
  { icon: Zap, title: 'AI Trace Panel', desc: 'Every AI output shows its trace: task type, model, sources, schema, confidence, safety critic.', features: ['Task trace', 'Source log', 'Schema validate', 'Safety critic'] },
  { icon: Users, title: 'Organization & Admin', desc: 'Tenant management. RBAC, team management, retention policies, model provider config.', features: ['RBAC', 'Team mgmt', 'Retention', 'Audit access'] },
  { icon: Bell, title: 'Notifications', desc: 'Multi-channel alerts for runs, overrides, reports, protocols. In-app, email, webhook.', features: ['In-app', 'Email', 'Webhook', 'Escalation'] },
  { icon: Plug, title: 'Integrations', desc: 'REST API, webhooks, CSV/JSON export, signed URLs. ELN/LIMS and SSO ready for V2.', features: ['REST API', 'Webhooks', 'Export', 'ELN ready'] },
];

const PIPELINES = [
  'Protocol Compiler — converts document packs into schema-validated protocol graphs',
  'Cross-Document Conflict Resolver — identifies conflicts between SOP, SDS, manual, and policy',
  'Hazard Mapper — maps SDS requirements to specific execution steps',
  'Visual Checkpoint Verifier — checks photos against step-specific checklists',
  'Safety Critic — reviews outputs for unsupported claims and overconfidence',
];

export default function Platform() {
  const cardsRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardsRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(cardsRef.current!.children, {
        y: 60, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: cardsRef.current, start: 'top 80%' },
      });
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!pipelineRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(pipelineRef.current!.children, {
        x: -30, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: pipelineRef.current, start: 'top 80%' },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="pt-16">
      <PageHero label="Platform" title="The complete protocol runtime platform"
        subtitle="Twelve modules working together to turn your lab documents into executable, verifiable, traceable protocol runtime." />

      <section className="theme-section py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>Modules</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold text-white tracking-tight">Every module, deeply integrated</h2>
          </div>
          <div ref={cardsRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map(({ icon: Icon, title, desc, features }) => (
              <div key={title} className="rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(0,86,199,0.25)]" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(0,86,199,0.2)' }}>
                  <Icon size={20} style={{ color: 'var(--cobalt-light)' }} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {features.map((f) => (
                    <span key={f} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,86,199,0.12)', color: 'var(--cobalt-light)' }}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-section-soft py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>AI Pipelines</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-semibold text-white tracking-tight">Opus 4.7, deeply integrated</h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                OpenBench OS uses Opus 4.7 as a compiler, verifier, safety critic, conflict resolver, and historian. Every AI output passes through structured schemas, safety review, and source citation checks.
              </p>
              <div ref={pipelineRef} className="mt-8 space-y-4">
                {PIPELINES.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--cobalt)', boxShadow: '0 0 8px rgba(0,86,199,0.5)' }} />
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ boxShadow: '0 0 40px rgba(0,86,199,0.15)' }}>
              <img src="/images/audit-trail.jpg" alt="AI Pipeline" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
