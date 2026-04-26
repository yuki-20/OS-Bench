'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  ArrowLeft,
  CheckCircle2,
  Archive,
  Download,
  Users,
  GitBranch,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

interface VersionEntry {
  version: string;
  publishedAt: string;
  publishedBy: string;
  changes: string;
  runsTotal: number;
  deviationRate: string;
}

const VERSION_HISTORY: VersionEntry[] = [
  {
    version: 'v4.1',
    publishedAt: '2026-04-20T10:00:00Z',
    publishedBy: 'Dr. Chen Wei',
    changes:
      'Updated transfer membrane step with new pressure thresholds. Added PPE requirements for Step 14.',
    runsTotal: 142,
    deviationRate: '4.2%',
  },
  {
    version: 'v4.0',
    publishedAt: '2026-02-14T09:00:00Z',
    publishedBy: 'Dr. Chen Wei',
    changes:
      'Major revision: Added vision checkpoint at Step 14. Updated blocking buffer concentration.',
    runsTotal: 98,
    deviationRate: '6.1%',
  },
  {
    version: 'v3.2',
    publishedAt: '2025-11-01T11:00:00Z',
    publishedBy: 'Marcus Adeyemi',
    changes: 'Minor fix: Corrected incubation temperature in Step 10 from 4°C to RT.',
    runsTotal: 76,
    deviationRate: '5.8%',
  },
  {
    version: 'v3.0',
    publishedAt: '2025-08-15T14:00:00Z',
    publishedBy: 'Dr. Chen Wei',
    changes: 'Restructured gel loading steps. Added molecular weight marker requirement.',
    runsTotal: 54,
    deviationRate: '7.3%',
  },
];

const ASSIGNED_OPERATORS = [
  { name: 'Yuki Tanaka', role: 'Senior Operator', assignedAt: '2026-04-21', runs: 12 },
  { name: 'Liam Chen', role: 'Operator', assignedAt: '2026-04-21', runs: 8 },
  { name: 'Amara Diallo', role: 'Operator', assignedAt: '2026-04-22', runs: 5 },
];

const PROTOCOL_STEPS = [
  {
    num: 1,
    title: 'Equipment Preparation',
    description:
      'Prepare all required equipment and verify calibration certificates are current within 30 days.',
  },
  {
    num: 2,
    title: 'Reagent Preparation',
    description:
      'Prepare all reagents according to manufacturer specifications. Check expiry dates.',
  },
  {
    num: 3,
    title: 'Sample Preparation',
    description:
      'Prepare samples at 1mg/mL concentration in sample buffer. Maintain cold chain throughout.',
  },
  {
    num: 4,
    title: 'Buffer Preparation',
    description: 'Prepare 1× running buffer. Degas for 15 minutes under vacuum.',
  },
  {
    num: 5,
    title: 'Gel Casting',
    description:
      'Cast 12% resolving and 4% stacking gels. Allow to polymerize for 30 minutes at RT.',
  },
  {
    num: 6,
    title: 'Sample Loading',
    description: 'Load 20µL per lane. Include molecular weight marker in lane 1.',
  },
  {
    num: 7,
    title: 'Electrophoresis Run',
    description: 'Run at 120V for 90 minutes or until dye front reaches bottom of gel.',
  },
  {
    num: 8,
    title: 'Transfer Setup',
    description: 'Assemble transfer sandwich. Ensure no air bubbles between gel and PVDF membrane.',
  },
  {
    num: 9,
    title: 'Transfer Run',
    description: 'Transfer at 100V for 60 minutes in cold room (4°C).',
  },
  {
    num: 10,
    title: 'Blocking',
    description:
      'Block membrane in 5% non-fat milk/TBST for 1 hour at room temperature with gentle agitation.',
  },
  {
    num: 11,
    title: 'Primary Antibody',
    description: 'Incubate with primary antibody at 1:1000 dilution overnight at 4°C.',
  },
  {
    num: 12,
    title: 'Washing',
    description: 'Wash 3× with TBST, 10 minutes each wash with gentle agitation.',
  },
  {
    num: 13,
    title: 'Secondary Antibody',
    description: 'Incubate with HRP-conjugated secondary antibody at 1:5000 for 1 hour at RT.',
  },
  {
    num: 14,
    title: 'Vision Checkpoint',
    description:
      'Perform visual membrane integrity check. Integrity score must be ≥85% to proceed.',
  },
  {
    num: 15,
    title: 'Detection',
    description: 'Apply ECL substrate. Image with chemiluminescence imager within 5 minutes.',
  },
  {
    num: 16,
    title: 'Documentation',
    description: 'Record all results in LIMS. Archive gel images and blot scans.',
  },
  {
    num: 17,
    title: 'Cleanup',
    description: 'Dispose of all hazardous waste per SDS guidelines. Clean equipment.',
  },
  {
    num: 18,
    title: 'Handover',
    description: 'Complete digital handover form. Flag any deviations for supervisor review.',
  },
];

interface Props {
  versionId: string;
}

export default function ProtocolVersionContent({ versionId }: Props) {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'history' | 'operators' | 'stats'>('steps');
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const currentVersion = VERSION_HISTORY[0];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/protocols"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-foreground">Western Blot SOP</h1>
              <StatusBadge status="published" type="protocol" size="md" />
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {currentVersion.version} · Protein Analysis · Published by{' '}
              {currentVersion.publishedBy} ·{' '}
              {new Date(currentVersion.publishedAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-all">
            <Download size={13} /> Export PDF
          </button>
          <button
            onClick={() => setArchiveConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-700 transition-all"
          >
            <Archive size={13} /> Archive
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Total Runs',
            value: currentVersion.runsTotal,
            icon: BarChart3,
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Active Runs',
            value: 2,
            icon: CheckCircle2,
            color: 'text-cyan-400',
            bg: 'bg-cyan-500/10',
          },
          {
            label: 'Deviation Rate',
            value: currentVersion.deviationRate,
            icon: AlertTriangle,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
          },
          {
            label: 'Assigned Operators',
            value: ASSIGNED_OPERATORS.length,
            icon: Users,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.bg}`}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-border rounded-xl p-1 w-fit">
        {(['steps', 'history', 'operators', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium capitalize transition-all ${activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab === 'history' ? 'Version History' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'steps' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-[13px] font-semibold text-foreground">
              {PROTOCOL_STEPS.length} Steps — Read-only view
            </p>
          </div>
          <div className="divide-y divide-border/40">
            {PROTOCOL_STEPS.map((step) => (
              <div key={step.num}>
                <div
                  className="px-5 py-3 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedStep(expandedStep === step.num ? null : step.num)}
                >
                  <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0 tabular-nums">
                    {step.num}
                  </span>
                  <p className="flex-1 text-[13px] font-medium text-foreground">{step.title}</p>
                  {expandedStep === step.num ? (
                    <ChevronUp size={13} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={13} className="text-muted-foreground" />
                  )}
                </div>
                {expandedStep === step.num && (
                  <div className="px-5 pb-3.5 animate-fade-in">
                    <p className="text-[13px] text-muted-foreground leading-relaxed pl-10">
                      {step.description}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <GitBranch size={14} className="text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Version History</p>
          </div>
          <div className="divide-y divide-border/40">
            {VERSION_HISTORY.map((v, idx) => (
              <div key={v.version}>
                <div
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() =>
                    setExpandedVersion(expandedVersion === v.version ? null : v.version)
                  }
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className={`font-mono text-[13px] font-semibold ${idx === 0 ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {v.version}
                    </span>
                    {idx === 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        current
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-muted-foreground">
                    {new Date(v.publishedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-[12px] text-muted-foreground">{v.publishedBy}</span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {v.runsTotal} runs
                  </span>
                  {expandedVersion === v.version ? (
                    <ChevronUp size={13} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={13} className="text-muted-foreground" />
                  )}
                </div>
                {expandedVersion === v.version && (
                  <div className="px-5 pb-4 animate-fade-in">
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{v.changes}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[12px] text-muted-foreground">
                        Deviation rate: <span className="text-amber-400">{v.deviationRate}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'operators' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground">Assigned Operators</p>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-border rounded-lg text-[12px] font-medium text-foreground hover:bg-zinc-700 transition-colors">
              <Users size={12} /> Manage Assignments
            </button>
          </div>
          <div className="divide-y divide-border/40">
            {ASSIGNED_OPERATORS.map((op) => (
              <div key={op.name} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-primary">
                    {op.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-foreground">{op.name}</p>
                  <p className="text-[11px] text-muted-foreground">{op.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] text-foreground tabular-nums">{op.runs} runs</p>
                  <p className="text-[11px] text-muted-foreground">since {op.assignedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: 'Total Runs (all versions)',
              value: '370',
              sub: 'Across 4 published versions',
            },
            { label: 'Avg Run Duration', value: '4h 12m', sub: 'Last 30 days' },
            { label: 'Checkpoint Pass Rate', value: '91.4%', sub: 'Vision checkpoints only' },
            { label: 'Override Rate', value: '3.1%', sub: 'Steps requiring override' },
            { label: 'Critical Deviations', value: '8', sub: 'Last 90 days' },
            { label: 'Completed Without Deviation', value: '78%', sub: 'Last 30 days' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
                {stat.label}
              </p>
              <p className="text-3xl font-bold text-foreground tabular-nums">{stat.value}</p>
              <p className="text-[12px] text-muted-foreground mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Archive size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Archive Protocol?</p>
                <p className="text-[12px] text-muted-foreground">Western Blot SOP v4.1</p>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Archiving will prevent new runs from being started with this version. Active runs will
              not be affected.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setArchiveConfirm(false)}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-[13px] font-medium hover:bg-amber-500 transition-colors"
              >
                Archive Version
              </button>
              <button
                onClick={() => setArchiveConfirm(false)}
                className="flex-1 py-2.5 bg-zinc-800 border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
