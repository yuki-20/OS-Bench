'use client';
import React, { useState } from 'react';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';

const STATUS_OPTIONS = [
  'active',
  'deviated',
  'blocked',
  'paused',
  'awaiting_override',
  'completed',
];
const PROTOCOL_OPTIONS = [
  'Buffer Exchange SOP v2.1',
  'Cell Viability Assay v1.4',
  'Protein Purification Protocol v3.0',
  'PCR Amplification v2.3',
  'ELISA Sandwich Assay v1.2',
];
const OPERATOR_OPTIONS = [
  'Dr. Priya Nair',
  'James Okonkwo',
  'Sofia Reyes',
  'Liam Chen',
  'Amara Diallo',
];
const DATE_PRESETS = ['Today', 'Last 7 days', 'Last 30 days', 'This month'];

export default function DashboardFilters() {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['active', 'blocked']);
  const [selectedProtocol, setSelectedProtocol] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [datePreset, setDatePreset] = useState('Last 7 days');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const toggleStatus = (s: string) => {
    setSelectedStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const clearAll = () => {
    setSelectedStatuses([]);
    setSelectedProtocol('');
    setSelectedOperator('');
    setDatePreset('Last 7 days');
  };

  const activeFilterCount =
    selectedStatuses.length + (selectedProtocol ? 1 : 0) + (selectedOperator ? 1 : 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <SlidersHorizontal size={13} />
          Filters
        </div>

        {/* Date preset */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-border rounded-lg px-1 py-0.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={`preset-${p}`}
              onClick={() => setDatePreset(p)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-all ${
                datePreset === p
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Protocol */}
        <select
          value={selectedProtocol}
          onChange={(e) => setSelectedProtocol(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">All Protocols</option>
          {PROTOCOL_OPTIONS.map((p) => (
            <option key={`proto-${p}`} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Operator */}
        <select
          value={selectedOperator}
          onChange={(e) => setSelectedOperator(e.target.value)}
          className="bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">All Operators</option>
          {OPERATOR_OPTIONS.map((o) => (
            <option key={`op-${o}`} value={o}>
              {o}
            </option>
          ))}
        </select>

        {/* Status multi-select */}
        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown((s) => !s)}
            className="flex items-center gap-1.5 bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground hover:border-primary/50 transition-colors"
          >
            Run Status
            {selectedStatuses.length > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {selectedStatuses.length}
              </span>
            )}
            <ChevronDown size={12} className="text-muted-foreground" />
          </button>
          {showStatusDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-border rounded-xl shadow-xl z-20 py-1.5 min-w-[180px] animate-fade-in">
              {STATUS_OPTIONS.map((s) => (
                <label
                  key={`status-opt-${s}`}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer hover:bg-white/5 transition-colors capitalize"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s)}
                    onChange={() => toggleStatus(s)}
                    className="accent-primary"
                  />
                  {s.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {selectedStatuses.map((s) => (
          <span
            key={`chip-${s}`}
            className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
          >
            {s.replace(/_/g, ' ')}
            <button onClick={() => toggleStatus(s)} className="hover:text-white transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}

        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
