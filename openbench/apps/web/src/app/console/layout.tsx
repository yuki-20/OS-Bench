"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  AlertTriangle,
  Bell,
  ClipboardList,
  FileText,
  FlaskConical,
  Gauge,
  Home,
  PlaySquare,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/cn";

const NAV: { href: string; label: string; icon: any; minRole?: string }[] = [
  { href: "/console", label: "Dashboard", icon: Home },
  { href: "/console/protocols", label: "Protocols", icon: FileText },
  { href: "/console/runs", label: "Runs", icon: PlaySquare },
  { href: "/console/deviations", label: "Deviations", icon: AlertTriangle },
  { href: "/console/escalations", label: "Escalations", icon: Bell, minRole: "reviewer" },
  { href: "/console/reports", label: "Reports", icon: ClipboardList },
  { href: "/console/evaluation", label: "Evaluation", icon: FlaskConical, minRole: "reviewer" },
  { href: "/console/team", label: "Team", icon: Users, minRole: "manager" },
  { href: "/console/settings", label: "Settings", icon: SettingsIcon, minRole: "admin" },
  { href: "/console/audit", label: "Audit", icon: ShieldCheck, minRole: "manager" },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { ready, user, activeOrgId, hasRole, signOut, setActiveOrg } = useSession();

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=" + encodeURIComponent(path || "/console"));
  }, [ready, user, router, path]);

  if (!ready) {
    return (
      <div className="p-12 text-center text-ink-500">Loading…</div>
    );
  }
  if (!user) return null;

  const activeMembership = user.memberships.find((m) => m.org_id === activeOrgId);

  return (
    <div className="min-h-screen flex bg-ink-50 text-ink-900">
      <aside className="w-60 bg-ink-900 text-ink-100 flex flex-col">
        <div className="p-4 border-b border-ink-800">
          <Link href="/" className="text-sm font-bold tracking-wider uppercase">OpenBench OS</Link>
          <div className="text-[10px] text-ink-400 uppercase tracking-wider mt-1">Control Console</div>
        </div>
        <nav className="flex-1 p-2 space-y-1 text-sm">
          {NAV.map(({ href, label, icon: Icon, minRole }) => {
            if (minRole && !hasRole(minRole)) return null;
            const active = path === href || (href !== "/console" && path?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 hover:bg-ink-800",
                  active && "bg-ink-800 text-white",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-ink-800 text-xs">
          <div className="text-ink-400">{activeMembership?.org_name}</div>
          <div className="text-white truncate">{user.display_name}</div>
          <div className="text-ink-400 mt-1 uppercase tracking-wide text-[10px]">
            {activeMembership?.role}
          </div>
          {user.memberships.length > 1 && (
            <select
              className="mt-2 w-full rounded bg-ink-800 border-ink-700 text-xs px-2 py-1"
              value={activeOrgId || ""}
              onChange={(e) => setActiveOrg(e.target.value)}
            >
              {user.memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {m.org_name} · {m.role}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2 mt-2">
            <Link
              href="/app"
              className="flex-1 text-center rounded bg-brand-700 text-white px-2 py-1 hover:bg-brand-500"
            >
              Bench
            </Link>
            <button
              onClick={() => {
                signOut();
                router.push("/login");
              }}
              className="flex-1 rounded bg-ink-800 px-2 py-1 hover:bg-ink-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
