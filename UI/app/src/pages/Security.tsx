import { Lock, Database, Fingerprint, Shield, Eye, Server, FileCheck, Clock } from 'lucide-react';
import { PageHero } from '@/components/PageHero';

const FEATURES = [
  { icon: Lock, title: 'TLS in Transit', desc: 'All communications use TLS encryption. No data travels unencrypted between client, console, and cloud.' },
  { icon: Database, title: 'Encryption at Rest', desc: 'PostgreSQL and S3-compatible storage use AES-256. Protocols, runs, attachments — all encrypted.' },
  { icon: Fingerprint, title: 'Encrypted Local Cache', desc: 'Bench Runtime Client stores data in encrypted SQLite. Protected even on shared workstations.' },
  { icon: Shield, title: 'Role-Based Access', desc: 'Five roles with precise permissions. Database-enforced row-level isolation between tenants.' },
  { icon: Eye, title: 'Audit Logging', desc: 'Every action logged with timestamps. Who uploaded, published, started, approved, exported.' },
  { icon: Server, title: 'Tenant Isolation', desc: 'Row-level security in PostgreSQL. No cross-tenant access possible at the database layer.' },
  { icon: FileCheck, title: 'Schema-Validated AI', desc: 'All AI outputs pass JSON schemas and a safety critic. No free-form safety claims without citations.' },
  { icon: Clock, title: 'Configurable Retention', desc: 'Set policies per org. Automatic cleanup with export options. Your data, your rules.' },
];

const COMPLIANCE = [
  { label: 'SOC 2 Type II', status: 'In Progress', dot: '#7D8B6F' },
  { label: 'GDPR Ready', status: 'Ready', dot: '#0056C7' },
  { label: 'HIPAA Awareness', status: 'Built', dot: '#0056C7' },
  { label: '21 CFR Part 11', status: 'Aligned', dot: '#0056C7' },
  { label: 'ISO 27001', status: 'Planned', dot: '#6B7280' },
];

const PRIVACY = [
  { title: 'No training on your documents', text: 'Customer documents are never used to train foundation models. Your proprietary procedures remain exclusively yours.' },
  { title: 'Data export and deletion', text: 'Full data export and deletion workflows exist for every tenant. Export your protocols, runs, and reports at any time.' },
  { title: 'Tenant access control', text: 'All attachments and reports inherit tenant access control. Photos, documents, and reports only visible to authorized members.' },
  { title: 'Optional redaction support', text: 'Names, sample IDs, and sensitive identifiers can be redacted in exports for stricter privacy requirements.' },
];

export default function Security() {
  return (
    <div className="pt-16">
      <PageHero label="Security" title="Security-first by design" subtitle="Every layer is built with security, privacy, and compliance in mind." />

      <section className="theme-section-soft py-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-3">
            {COMPLIANCE.map(({ label, status, dot }) => (
              <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: dot }} />
                <span className="text-sm font-medium text-white">{label}</span>
                <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-section py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>Security Features</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold text-white tracking-tight">Defense in depth</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border p-6" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(0,86,199,0.15)' }}>
                  <Icon size={20} style={{ color: 'var(--cobalt-light)' }} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-section-soft py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>Privacy</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold text-white tracking-tight">Your data stays yours</h2>
          </div>
          <div className="space-y-4">
            {PRIVACY.map(({ title, text }) => (
              <div key={title} className="rounded-2xl border p-6 flex gap-4 items-start" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(125,139,111,0.15)' }}>
                  <Shield size={16} style={{ color: 'var(--sage-light)' }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
