import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Building2 } from 'lucide-react';
import { PageHero } from '@/components/PageHero';

gsap.registerPlugin(ScrollTrigger);

const PLANS = [
  {
    name: 'Starter', desc: 'For small labs getting started',
    price: '$299', period: '/month',
    features: ['Up to 10 protocol versions', '3 team members', 'Basic protocol compiler', 'Run engine with state tracking', 'Step Q&A with citations', 'Visual checkpoints (50/mo)', 'Standard handover reports', 'Email support'],
  },
  {
    name: 'Professional', desc: 'For growing labs with active protocol management',
    price: '$799', period: '/month', popular: true,
    features: ['Unlimited protocol versions', '15 team members', 'Advanced compiler with confidence', 'Full run engine with deviations', 'Visual checkpoints (500/mo)', 'AI Trace panel', 'Deviation & override workflows', 'Priority support'],
  },
  {
    name: 'Enterprise', desc: 'For organizations with compliance requirements',
    price: 'Custom', period: '',
    features: ['Everything in Professional', 'Unlimited team members', 'Unlimited checkpoints', 'SSO / SCIM integration', 'Custom retention policies', 'Audit log exports', 'ELN/LIMS connectors', 'Dedicated success manager', 'SLA guarantee', 'On-premise option'],
  },
];

export default function Pricing() {
  const cardsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!cardsRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(cardsRef.current!.children, {
        y: 60, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out',
        scrollTrigger: { trigger: cardsRef.current, start: 'top 80%' },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="pt-16">
      <PageHero
        label="Pricing"
        title="Simple, clear pricing"
        subtitle="Choose the plan that fits your lab. All plans include core protocol compilation, run execution, and audit trails."
      />

      <section className="theme-section py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div ref={cardsRef} className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map(({ name, desc, price, period, popular, features }) => (
              <div
                key={name}
                className={`rounded-2xl border transition-all duration-300 ${popular ? 'md:-mt-4 md:mb-4' : ''}`}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderColor: popular ? 'rgba(0,86,199,0.4)' : 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: popular ? '0 0 60px rgba(0,86,199,0.15)' : 'none',
                }}
              >
                {popular && (
                  <div className="text-center py-2 text-xs font-semibold uppercase tracking-wider text-white rounded-t-2xl" style={{ background: 'var(--cobalt)' }}>
                    Most Popular
                  </div>
                )}
                <div className={`p-8 ${popular ? 'pt-6' : ''}`}>
                  <h3 className="text-xl font-semibold text-white">{name}</h3>
                  <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold font-mono" style={{ color: popular ? 'var(--cobalt-light)' : 'rgba(255,255,255,0.7)' }}>{price}</span>
                    {period && <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{period}</span>}
                  </div>
                  <ul className="mt-6 space-y-3">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: popular ? 'var(--cobalt-light)' : 'var(--sage-light)' }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate(name === 'Enterprise' ? '/dashboard' : '/signup')}
                    className="mt-8 w-full py-3 rounded-lg font-semibold text-sm transition-all cursor-pointer"
                    style={{
                      background: popular ? 'var(--cobalt)' : 'rgba(255,255,255,0.08)',
                      color: popular ? 'white' : 'var(--cobalt-light)',
                      border: popular ? 'none' : '1.5px solid rgba(255,255,255,0.14)',
                      backdropFilter: 'blur(14px)',
                    }}
                  >
                    {name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-section-soft py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(125,139,111,0.15)' }}>
            <Building2 size={22} style={{ color: 'var(--sage-light)' }} />
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold text-white">Need a custom deployment?</h2>
          <p className="mt-3 text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Self-hosted deployments, VPC installations, custom integrations, and validated workflows for regulated environments.
          </p>
          <button className="mt-6 px-8 py-3 rounded-lg font-semibold text-sm text-white transition-all cursor-pointer" style={{ background: 'var(--sage)' }}>
            Contact Enterprise Sales
          </button>
        </div>
      </section>
    </div>
  );
}
