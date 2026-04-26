'use client';
import React from 'react';
import { CheckCircle2, XCircle, Camera, AlertTriangle } from 'lucide-react';
import { useRunDetail } from './RunDetailContext';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function RunPhotosTab() {
  const { detail } = useRunDetail();
  if (!detail) return null;

  const assessments = detail.photo_assessments;

  if (assessments.length === 0 && detail.attachments.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground flex flex-col items-center gap-2">
        <Camera size={24} className="text-muted-foreground/50" />
        No photos or attachments captured for this run yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {assessments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[13px] font-semibold text-foreground">
            Photo Assessments ({assessments.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assessments.map((a) => {
              const pass = a.result === 'pass' || a.result === 'passed';
              const fail = a.result === 'fail' || a.result === 'failed';
              const Icon = pass ? CheckCircle2 : fail ? XCircle : AlertTriangle;
              const color = pass ? 'text-emerald-400' : fail ? 'text-red-400' : 'text-amber-400';
              return (
                <div key={a.id} className="border border-border rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={color} />
                    <span className={`text-[12px] font-medium ${color} capitalize`}>
                      {a.result}
                    </span>
                    {typeof a.confidence === 'number' && (
                      <span className="ml-auto text-[11px] text-muted-foreground font-mono">
                        {Math.round(a.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  {a.notes && (
                    <p className="mt-2 text-[12px] text-muted-foreground line-clamp-3">{a.notes}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    {a.step_id && <span>step {a.step_id.slice(-8)}</span>}
                    <span>{formatTime(a.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detail.attachments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[13px] font-semibold text-foreground">
            Attachments ({detail.attachments.length})
          </h4>
          <div className="border border-border rounded-lg divide-y divide-border max-h-80 overflow-y-auto scrollbar-thin">
            {detail.attachments.map((att) => (
              <div key={att.id} className="px-3 py-2 flex items-center gap-2">
                <Camera size={13} className="text-muted-foreground" />
                <span className="text-[12px] text-foreground capitalize">{att.kind}</span>
                <span className="ml-2 text-[11px] text-muted-foreground font-mono truncate flex-1">
                  {att.storage_path}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {formatTime(att.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
