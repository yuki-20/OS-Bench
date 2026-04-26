"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSession } from "@/lib/session";
import { startSyncLoop, listPending } from "@/lib/offline";
import { cn } from "@/lib/cn";

const NAV: { href: string; label: string }[] = [
  { href: "/app", label: "Home" },
  { href: "/app/protocols", label: "Protocols" },
  { href: "/app/runs", label: "Active runs" },
  { href: "/app/sync", label: "Sync" },
  { href: "/app/settings", label: "Settings" },
];

export default function BenchShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { ready, user, signOut } = useSession();
  const [theme, setTheme] = useState("normal");
  const [largeText, setLargeText] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const stop = startSyncLoop(`device_${navigator.userAgent.slice(0, 16)}`);
    const tick = async () => setPending((await listPending()).length);
    const t = setInterval(tick, 4000);
    tick();
    const onOff = () => setOnline(navigator.onLine);
    window.addEventListener("online", onOff);
    window.addEventListener("offline", onOff);
    setOnline(navigator.onLine);
    return () => {
      stop();
      clearInterval(t);
      window.removeEventListener("online", onOff);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.largeText = String(largeText);
      document.documentElement.dataset.criticalOnly = String(criticalOnly);
    }
  }, [theme, largeText, criticalOnly]);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=" + encodeURIComponent(path || "/app"));
  }, [ready, user, router, path]);

  if (!ready || !user) {
    return <div className="p-12 text-center text-ink-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex bg-white">
      <aside className="w-56 bg-ink-900 text-ink-100 flex flex-col">
        <div className="p-4 border-b border-ink-800">
          <Link href="/" className="text-sm font-bold tracking-wider uppercase">OpenBench</Link>
          <div className="text-[10px] text-ink-400 uppercase tracking-wider mt-1">Bench Runtime</div>
        </div>
        <nav className="flex-1 p-2 space-y-1 text-sm non-critical">
          {NAV.map(({ href, label }) => {
            const active = path === href || (href !== "/app" && path?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "block bench-target rounded px-3 hover:bg-ink-800",
                  active && "bg-ink-800 text-white",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-ink-800 text-xs space-y-2 non-critical">
          <div>
            <div className="text-ink-400">Operator</div>
            <div className="text-white truncate">{user.display_name}</div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full",
                online ? "bg-ok-400" : "bg-warn-400",
              )}
            />
            <span>{online ? "Online" : "Offline"}</span>
            {pending > 0 && (
              <span className="ml-auto text-warn-400">{pending} queued</span>
            )}
          </div>
          <Link href="/console" className="block text-center rounded bg-ink-800 px-2 py-1 hover:bg-ink-700">
            Console
          </Link>
          <button
            onClick={() => {
              signOut();
              router.push("/login");
            }}
            className="w-full rounded bg-ink-800 px-2 py-1 hover:bg-ink-700"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-ink-100 border-b border-ink-200 px-4 py-2 flex items-center gap-2 non-critical">
          <span className="text-xs text-ink-600">Accessibility:</span>
          <button
            onClick={() => setLargeText((v) => !v)}
            className={cn(
              "text-xs px-2 py-1 rounded border",
              largeText ? "bg-ink-900 text-white" : "bg-white",
            )}
          >
            Large text
          </button>
          <button
            onClick={() =>
              setTheme((t) => (t === "hi-contrast" ? "normal" : "hi-contrast"))
            }
            className={cn(
              "text-xs px-2 py-1 rounded border",
              theme === "hi-contrast" ? "bg-ink-900 text-white" : "bg-white",
            )}
          >
            High contrast
          </button>
          <button
            onClick={() => setCriticalOnly((v) => !v)}
            className={cn(
              "text-xs px-2 py-1 rounded border",
              criticalOnly ? "bg-ink-900 text-white" : "bg-white",
            )}
          >
            Critical only
          </button>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
