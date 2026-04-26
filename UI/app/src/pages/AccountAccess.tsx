import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Mail, Lock, Building2, ArrowRight } from 'lucide-react';
import { SectionLabel } from '@/components/SectionLabel';
import { AuthError, dashboardUrlWithTokens, login, register } from '@/lib/dashboard';

function getDisplayName(email: string) {
  return (
    email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join(' ') || 'OpenBench User'
  );
}

function AuthPanel({ isLogin }: { isLogin: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowForm(true), 650);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;
    const trimmedOrganization = organization.trim();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!isLogin && !trimmedOrganization) {
      setError('Enter your organization name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const tokens = isLogin
        ? await login(normalizedEmail, trimmedPassword)
        : await register({
            email: normalizedEmail,
            password: trimmedPassword,
            display_name: getDisplayName(normalizedEmail),
            org_name: trimmedOrganization,
          });
      // Hand off to the console with tokens in the URL — its AuthProvider
      // picks them up, hydrates the session, and lands on the dashboard.
      window.location.href = dashboardUrlWithTokens(tokens);
    } catch (err) {
      let message: string;
      if (err instanceof AuthError) {
        if (err.status === 401) message = 'Invalid email or password.';
        else if (err.status === 409) message = 'That email already has an account. Log in instead.';
        else message = err.message;
      } else if (err instanceof TypeError) {
        message = 'Could not reach the API. Is it running on http://localhost:8000?';
      } else {
        message = err instanceof Error ? err.message : 'Something went wrong.';
      }
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="mt-10 md:mt-0 rounded-2xl border p-6 md:p-8 transform-gpu animate-[accountCardIn_650ms_cubic-bezier(0.22,1,0.36,1)_both]"
      style={{
        background: 'rgba(255,255,255,0.055)',
        borderColor: 'rgba(255,255,255,0.11)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 24px 70px rgba(0,0,0,0.22)',
      }}
    >
      <div className="relative min-h-[432px] overflow-hidden">
        <div
          className={`absolute inset-0 flex flex-col justify-center text-center transition-all duration-500 ${
            showForm ? 'pointer-events-none -translate-y-5 opacity-0' : 'translate-y-0 opacity-100'
          }`}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(0,86,199,0.22)' }}
          >
            <ArrowRight size={24} style={{ color: 'var(--cobalt-light)' }} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-white">
            {isLogin ? 'Opening secure login' : 'Preparing account setup'}
          </h2>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.56)' }}
          >
            {isLogin
              ? 'Loading your workspace access panel.'
              : 'Loading the organization account panel.'}
          </p>
          <div
            className="mx-auto mt-8 h-1.5 w-40 overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full w-full origin-left animate-[accountProgress_650ms_ease-out_both]"
              style={{ background: 'var(--cobalt)' }}
            />
          </div>
        </div>

        <div
          className={`transition-all duration-500 ${
            showForm ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
          }`}
        >
          <div
            className="flex rounded-lg p-1 mb-6"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Link
              to="/signup"
              className="flex-1 rounded-md px-4 py-2 text-center text-sm font-semibold no-underline transition-colors"
              style={{
                background: !isLogin ? 'var(--cobalt)' : 'rgba(255,255,255,0.055)',
                color: !isLogin ? 'white' : 'rgba(255,255,255,0.65)',
              }}
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="flex-1 rounded-md px-4 py-2 text-center text-sm font-semibold no-underline transition-colors"
              style={{
                background: isLogin ? 'var(--cobalt)' : 'rgba(255,255,255,0.055)',
                color: isLogin ? 'white' : 'rgba(255,255,255,0.65)',
              }}
            >
              Log in
            </Link>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <label className="block">
                <span className="text-sm font-medium text-white">Organization</span>
                <div
                  className="mt-2 flex items-center gap-3 rounded-lg border px-3"
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Building2 size={18} style={{ color: 'rgba(255,255,255,0.42)' }} />
                  <input
                    type="text"
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                    placeholder="Acme Labs"
                    autoComplete="organization"
                    className="h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-white">Email</span>
              <div
                className="mt-2 flex items-center gap-3 rounded-lg border px-3"
                style={{
                  borderColor: 'rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <Mail size={18} style={{ color: 'rgba(255,255,255,0.42)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@lab.org"
                  autoComplete="email"
                  className="h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Password</span>
              <div
                className="mt-2 flex items-center gap-3 rounded-lg border px-3"
                style={{
                  borderColor: 'rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <Lock size={18} style={{ color: 'rgba(255,255,255,0.42)' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                />
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--cobalt)',
                boxShadow: 'var(--shadow-cobalt)',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting
                ? 'Opening dashboard'
                : isLogin
                  ? 'Log in'
                  : 'Create account'}
              <ArrowRight size={16} />
            </button>
          </form>

          <p
            className="mt-6 text-center text-sm"
            style={{ color: 'rgba(255,255,255,0.56)' }}
          >
            {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
            <Link
              to={isLogin ? '/signup' : '/login'}
              className="font-semibold no-underline"
              style={{ color: 'var(--cobalt-light)' }}
            >
              {isLogin ? 'Create one' : 'Log in'}
            </Link>
          </p>
          {isLogin && (
            <p className="mt-3 text-center text-[11px] text-white/40">
              Demo: <span className="font-mono">admin@demo.lab</span> /{' '}
              <span className="font-mono">Bench!Demo1</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountAccess() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  useEffect(() => {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill(true));
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="pt-16">
      <section className="theme-section-soft min-h-[calc(100vh-4rem)] flex items-center">
        <div className="grid w-full max-w-6xl mx-auto px-6 py-12 md:grid-cols-[1fr_420px] md:items-center md:gap-14">
          <div className="text-center md:text-left">
            <SectionLabel text={isLogin ? 'Log In' : 'Create Account'} light />
            <h1 className="mt-5 text-4xl md:text-6xl font-semibold text-white tracking-tight leading-tight">
              {isLogin
                ? 'Access your OpenBench workspace'
                : 'Create your OpenBench account'}
            </h1>
            <p
              className="mt-5 text-base md:text-lg leading-relaxed mx-auto md:mx-0 max-w-2xl"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {isLogin
                ? 'Sign in to review protocols, manage runs, and continue lab execution workflows.'
                : 'Set up your organization workspace and invite your team into a guided protocol runtime.'}
            </p>
          </div>

          <AuthPanel key={location.pathname} isLogin={isLogin} />
        </div>
      </section>
    </div>
  );
}
