import { useEffect } from 'react';
import { getLoginUrl } from '@/lib/dashboard';

export default function DashboardRedirect() {
  const url = typeof window === 'undefined' ? '' : getLoginUrl();

  useEffect(() => {
    window.location.replace(getLoginUrl());
  }, []);

  return (
    <div className="pt-16">
      <section className="theme-section-soft min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 text-center">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.2em]"
            style={{ color: 'var(--cobalt-light)' }}
          >
            Console
          </p>
          <h1 className="mt-4 text-3xl md:text-5xl font-semibold text-white tracking-tight">
            Opening the OpenBench console
          </h1>
          <p className="mt-4 text-base text-white/70">
            If nothing happens in a few seconds, click below.
          </p>
          <a
            href={url}
            className="mt-8 inline-flex rounded-lg px-5 py-3 text-sm font-semibold text-white no-underline"
            style={{ background: 'var(--cobalt)' }}
          >
            Open console
          </a>
        </div>
      </section>
    </div>
  );
}
