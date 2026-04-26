'use client';

import React, { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  Mail,
  Shield,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';

const SEED_HINTS = [
  { email: 'admin@demo.lab', label: 'Admin Demo' },
  { email: 'reviewer@demo.lab', label: 'Reviewer Demo' },
  { email: 'operator@demo.lab', label: 'Operator Demo' },
];

export default function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await signIn(normalizedEmail, trimmedPassword);
      toast.success(`Signed in as ${user.display_name}`, {
        description: `Opening ${user.org_name}`,
      });
      router.push('/console-dashboard');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? 'Invalid email or password.'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Sign in failed. Is the API running on http://localhost:8000?';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-zinc-950 border-r border-border p-10">
        <div className="flex items-center gap-2.5">
          <AppLogo size={36} />
          <span className="font-bold text-[17px] text-foreground tracking-tight">OpenBench OS</span>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-foreground leading-tight mb-4">
            Sign in to the
            <br />
            <span className="text-primary">control console.</span>
          </h2>
          <p className="text-[14px] text-muted-foreground leading-relaxed mb-8">
            Authenticated against the OpenBench API. The seeded demo organization is ready to go.
          </p>
          <div className="space-y-3">
            {[
              { icon: FlaskConical, label: 'Live run monitoring after sign in' },
              { icon: Shield, label: 'JWT session, refreshed automatically' },
              { icon: ClipboardCheck, label: 'Server-driven role and org context' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-primary" />
                  </div>
                  <span className="text-[13px] text-muted-foreground">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Default seed password: <span className="font-mono">Bench!Demo1</span>
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto scrollbar-thin">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <AppLogo size={32} />
            <span className="font-bold text-[16px] text-foreground">OpenBench OS</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Sign in to your console</h1>
          <p className="text-[13px] text-muted-foreground mb-7">
            Use a seeded demo account or any account you have on this API.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <label className="block">
              <span className="block text-[13px] font-medium text-foreground mb-1.5">
                Email address
              </span>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-zinc-900 border border-border rounded-lg pl-9 pr-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  placeholder="you@lab.org"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-[13px] font-medium text-foreground mb-1.5">Password</span>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-zinc-900 border border-border rounded-lg pl-9 pr-10 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-primary-foreground text-[14px] font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? 'Signing in' : 'Sign in'}
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="mt-7 rounded-xl border border-border bg-zinc-900 p-4">
            <p className="text-[13px] font-medium text-foreground">Seeded demo accounts</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Pre-seeded by the API on first boot. Click to fill the email — password is{' '}
              <span className="font-mono">Bench!Demo1</span>.
            </p>
            <div className="mt-3 space-y-2">
              {SEED_HINTS.map((hint) => (
                <button
                  key={hint.email}
                  type="button"
                  onClick={() => {
                    setEmail(hint.email);
                    setPassword('Bench!Demo1');
                  }}
                  className="w-full rounded-lg border border-border bg-zinc-950 px-3 py-2 text-left hover:bg-white/[0.03]"
                >
                  <span className="block text-[12px] font-medium text-foreground">
                    {hint.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground font-mono">
                    {hint.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
