import { Book, Code, Terminal, Cpu, ChevronRight, Search, FileText, Layers } from 'lucide-react';
import { PageHero } from '@/components/PageHero';

const CATEGORIES = [
  { icon: Book, title: 'Getting Started', items: ['Quick Start', 'System Requirements', 'Installation', 'First Protocol', 'First Run'] },
  { icon: Cpu, title: 'Protocol Compiler', items: ['Document Ingestion', 'Compilation', 'Reviewer Workflow', 'Publishing', 'Confidence Scoring'] },
  { icon: Terminal, title: 'Bench Runtime', items: ['Starting a Run', 'Step Navigation', 'Visual Checkpoints', 'Deviation Logging', 'Handover Reports'] },
  { icon: Code, title: 'API Reference', items: ['Authentication', 'Protocol Endpoints', 'Run Endpoints', 'AI Endpoints', 'Admin Endpoints'] },
  { icon: Layers, title: 'Integrations', items: ['Webhooks', 'CSV/JSON Export', 'REST API', 'Object Storage', 'ELN/LIMS'] },
  { icon: FileText, title: 'Security', items: ['Authentication', 'Role Permissions', 'Data Protection', 'Audit Logging', 'Compliance'] },
];

const ENDPOINTS = [
  { title: 'Authentication', method: 'POST', path: '/api/auth/login', desc: 'Sign in to web or desktop' },
  { title: 'Upload Document', method: 'POST', path: '/api/documents/upload', desc: 'Create upload with signed URL' },
  { title: 'Compile Protocol', method: 'POST', path: '/api/protocol-drafts/compile', desc: 'Compile draft from documents' },
  { title: 'Create Run', method: 'POST', path: '/api/runs', desc: 'Create run from protocol version' },
  { title: 'Step Q&A', method: 'POST', path: '/api/runs/{id}/ask', desc: 'Ask question scoped to step' },
  { title: 'Photo Check', method: 'POST', path: '/api/runs/{id}/photo-check', desc: 'Upload photo for assessment' },
];

export default function Docs() {
  return (
    <div className="pt-16">
      <PageHero label="Documentation" title="Everything you need to run OpenBench OS" subtitle="Comprehensive guides, API references, and integration docs for operators, reviewers, managers, and developers.">
        <div className="mt-8 max-w-xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <input type="text" placeholder="Search documentation..." className="w-full pl-11 pr-4 py-3 rounded-lg text-sm outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
        </div>
      </PageHero>

      <section className="theme-section py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>Browse</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold text-white tracking-tight">Documentation by topic</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CATEGORIES.map(({ icon: Icon, title, items }) => (
              <div key={title} className="group cursor-pointer rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,86,199,0.15)' }}>
                    <Icon size={20} style={{ color: 'var(--cobalt-light)' }} />
                  </div>
                  <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" style={{ color: 'rgba(255,255,255,0.3)' }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item} className="text-sm flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }} />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-section-soft py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>API Quick Reference</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold text-white tracking-tight">Common endpoints</h2>
          </div>
          <div className="space-y-3">
            {ENDPOINTS.map(({ title, method, path, desc }) => (
              <div key={title} className="rounded-xl border p-4 transition-all" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Code size={16} style={{ color: 'var(--cobalt-light)' }} />
                    <span className="text-sm font-semibold text-white truncate">{title}</span>
                  </div>
                  <code className="text-xs font-mono px-2 py-1 rounded flex-shrink-0" style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--cobalt-light)' }}>
                    <span style={{ color: 'var(--sage-light)' }}>{method}</span> {path}
                  </code>
                  <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
