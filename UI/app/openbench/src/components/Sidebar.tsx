'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from './ui/AppLogo';
import {
  LayoutDashboard,
  Activity,
  FileText,
  AlertTriangle,
  Users,
  Settings,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Bell,
  KeyRound,
} from 'lucide-react';
import { useDemoSession } from './AuthGate';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
  group?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/console-dashboard', group: 'Overview' },
  { label: 'Run Monitor', icon: Activity, href: '/run-monitor', group: 'Overview' },
  { label: 'Documents', icon: FileText, href: '/documents', group: 'Lab' },
  { label: 'Protocols', icon: FileText, href: '/protocols', group: 'Lab' },
  { label: 'Deviations', icon: AlertTriangle, href: '/deviation-reports', group: 'Lab' },
  { label: 'Audit Log', icon: ScrollText, href: '/audit-log', group: 'Compliance' },
  { label: 'Notifications', icon: Bell, href: '/notifications', group: 'Compliance' },
  { label: 'Team', icon: Users, href: '/team', group: 'Admin' },
  { label: 'API Keys', icon: KeyRound, href: '/api-keys', group: 'Admin' },
  { label: 'Settings', icon: Settings, href: '/settings', group: 'Admin' },
];

interface SidebarProps {
  currentPath?: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const session = useDemoSession();

  const groups = Array.from(new Set(navItems.map((i) => i.group)));

  return (
    <aside
      className="relative flex flex-col bg-zinc-950 border-r border-border shrink-0 transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-3 border-b border-border shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <AppLogo size={32} />
          {!collapsed && (
            <span className="font-semibold text-[15px] text-foreground tracking-tight whitespace-nowrap">
              OpenBench OS
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-hidden">
        {groups.map((group) => (
          <div key={`group-${group}`} className="mb-1">
            {!collapsed && (
              <p className="px-4 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                {group}
              </p>
            )}
            {navItems
              .filter((i) => i.group === group)
              .map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={`nav-${item.href}-${item.label}`}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-150 group
                    ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="text-[13.5px] font-medium whitespace-nowrap">
                          {item.label}
                        </span>
                        {item.badge !== undefined && (
                          <span className="ml-auto text-[10px] font-semibold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full tabular-nums">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && item.badge !== undefined && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* User */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-primary">{session.initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate">{session.name}</p>
              <p className="text-[10px] text-muted-foreground">{session.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-zinc-800 border border-border flex items-center justify-center hover:bg-zinc-700 transition-colors z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
