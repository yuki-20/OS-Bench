import { PageHero } from '@/components/PageHero';

const POSTS = [
  { cat: 'Product', title: 'Why Protocol Graphs Beat Document Chat', excerpt: 'The fundamental difference between a protocol runtime and an AI chat interface. Why structured execution graphs create safety that chat cannot.', date: 'Apr 20, 2026', read: '8 min', accent: '#0056C7' },
  { cat: 'Engineering', title: 'Building Audit-Ready Lab Software', excerpt: 'How we designed event journaling, conflict resolution, and sync strategies for traceable bench execution.', date: 'Apr 15, 2026', read: '12 min', accent: '#7D8B6F' },
  { cat: 'Safety', title: 'Visual Checkpoints: Not Magic, Just Good Engineering', excerpt: 'How the Vision Checkpoint Engine checks only visible conditions, avoids hidden-state guessing, and uses cannot-verify as a first-class state.', date: 'Apr 10, 2026', read: '6 min', accent: '#0056C7' },
  { cat: 'AI', title: 'Opus 4.7 as Protocol Compiler: Beyond Retrieval', excerpt: 'How we use Opus 4.7 for cross-document reasoning, conflict resolution, and hazard mapping — not just retrieval.', date: 'Apr 5, 2026', read: '10 min', accent: '#7D8B6F' },
  { cat: 'Compliance', title: 'Event Sourcing for Audit-Ready Lab Software', excerpt: 'Why append-only event logs create better audit trails than traditional CRUD. How we generate reports from events, not chat.', date: 'Mar 28, 2026', read: '9 min', accent: '#1C1E21' },
  { cat: 'Product', title: 'The Five Personas of Lab Protocol Software', excerpt: 'Designing for Operators, Reviewers, Managers, Safety Leads, and Admins — each with different needs and workflows.', date: 'Mar 20, 2026', read: '7 min', accent: '#0056C7' },
];

const FEATURED = {
  cat: 'Announcement',
  title: 'OpenBench OS v1.0: The Protocol Runtime Platform',
  excerpt: 'After two years of building alongside academic labs, biotech R&D teams, and safety officers, we are launching the first production-ready version of OpenBench OS — a protocol execution runtime that compiles approved lab documents into guided, verifiable, traceable workflows.',
  date: 'April 26, 2026',
  read: '5 min',
};

export default function Blog() {
  return (
    <div className="pt-16">
      <PageHero label="Blog" title="Thoughts on lab execution" subtitle="Product updates, engineering deep dives, safety insights, and stories from the labs using OpenBench OS." />

      <section className="theme-section-soft py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-2xl border p-8 md:p-10 cursor-pointer transition-all hover:-translate-y-1" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: 'rgba(0,86,199,0.2)', color: 'var(--cobalt-light)' }}>{FEATURED.cat}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{FEATURED.date} &middot; {FEATURED.read}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">{FEATURED.title}</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{FEATURED.excerpt}</p>
          </div>
        </div>
      </section>

      <section className="theme-section py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--cobalt-light)' }}>All Posts</span>
            <h2 className="mt-3 text-3xl font-semibold text-white tracking-tight">Latest from the team</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {POSTS.map(({ cat, title, excerpt, date, read, accent }) => (
              <div key={title} className="cursor-pointer group rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full uppercase tracking-wider" style={{ background: accent + '20', color: accent }}>{cat}</span>
                </div>
                <h3 className="text-lg font-semibold text-white leading-snug mb-2 group-hover:text-[var(--cobalt-light)] transition-colors">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{excerpt}</p>
                <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <span>{date}</span><span>&middot;</span><span>{read}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
