"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "ok" | "warn";
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };
  const variants: Record<string, string> = {
    primary: "bg-brand-600 text-white border-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600",
    secondary: "bg-white text-ink-800 border-ink-300 hover:bg-ink-100 focus-visible:ring-ink-300",
    ghost: "bg-transparent text-ink-700 border-transparent hover:bg-ink-100",
    danger: "bg-danger-600 text-white border-danger-600 hover:bg-danger-400 focus-visible:ring-danger-600",
    ok: "bg-ok-600 text-white border-ok-600 hover:bg-ok-400 focus-visible:ring-ok-600",
    warn: "bg-warn-600 text-white border-warn-600 hover:bg-warn-400 focus-visible:ring-warn-600",
  };
  return <button {...props} className={cn(base, sizes[size], variants[variant], className)} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-xl border border-ink-200 bg-white shadow-sm overflow-hidden",
        className,
      )}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("px-4 py-3 border-b border-ink-200 flex items-center", className)} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={cn("font-semibold text-ink-900", className)} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-4", className)} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
        className,
      )}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
        className,
      )}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("block text-xs font-medium text-ink-600 mb-1", className)} />;
}

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "ok" | "warn" | "danger" | "brand" | "muted";
}) {
  const colors: Record<string, string> = {
    default: "bg-ink-100 text-ink-700 border-ink-200",
    ok: "bg-ok-50 text-ok-600 border-ok-400/30",
    warn: "bg-warn-50 text-warn-600 border-warn-400/30",
    danger: "bg-danger-50 text-danger-600 border-danger-400/30",
    brand: "bg-brand-50 text-brand-700 border-brand-100",
    muted: "bg-ink-50 text-ink-500 border-ink-200",
  };
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center text-[11px] font-medium rounded-full px-2 py-0.5 border uppercase tracking-wide",
        colors[variant],
        className,
      )}
    />
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const tones: Record<string, string> = {
    default: "text-ink-900",
    warn: "text-warn-600",
    danger: "text-danger-600",
    ok: "text-ok-600",
  };
  return (
    <Card>
      <CardBody>
        <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
        <div className={cn("text-2xl font-semibold mt-1", tones[tone || "default"])}>{value}</div>
        {hint ? <div className="text-xs text-ink-500 mt-1">{hint}</div> : null}
      </CardBody>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="text-center">
      <CardBody className="py-12">
        <div className="text-base font-semibold text-ink-800">{title}</div>
        {description && <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardBody>
    </Card>
  );
}

export function Banner({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title?: string;
  children?: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "bg-brand-50 border-brand-100 text-brand-700",
    warn: "bg-warn-50 border-warn-400/30 text-warn-600",
    danger: "bg-danger-50 border-danger-400/30 text-danger-600",
    ok: "bg-ok-50 border-ok-400/30 text-ok-600",
  };
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", tones[tone])}>
      {title && <div className="font-semibold">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block animate-spin rounded-full border-2 border-ink-300 border-t-brand-600"
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn("relative bg-white rounded-lg shadow-2xl w-full", width)}>
        {title && (
          <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <button onClick={onClose} className="text-ink-500 hover:text-ink-800">
              ✕
            </button>
          </div>
        )}
        <div className="p-5 max-h-[80vh] overflow-auto scroll-soft">{children}</div>
      </div>
    </div>
  );
}
