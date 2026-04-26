import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white p-6">
      <div className="max-w-2xl text-center space-y-6">
        <div>
          <div className="text-xs tracking-widest text-brand-700 uppercase">OpenBench OS</div>
          <h1 className="text-4xl font-bold text-ink-900 mt-2">
            The AI runtime for safer lab execution.
          </h1>
          <p className="text-ink-600 mt-3">
            From SOP to safe handover in one guided run.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/console"
            className="inline-flex items-center justify-center rounded-md bg-brand-600 text-white px-5 py-3 font-medium hover:bg-brand-700"
          >
            Open Web Control Console →
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center justify-center rounded-md border border-brand-200 text-brand-700 px-5 py-3 font-medium hover:bg-brand-50"
          >
            Open Bench Runtime →
          </Link>
        </div>
      </div>
    </main>
  );
}
