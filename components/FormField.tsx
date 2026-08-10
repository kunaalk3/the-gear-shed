"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>;

export function FormField({ label, hint, id, ...props }: FieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1.5 font-body text-sm">
      <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">{label}</span>
      <input
        id={fieldId}
        {...props}
        className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
      />
      {hint && <span className="font-body text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

type TextareaProps = { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function FormTextarea({ label, id, ...props }: TextareaProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1.5 font-body text-sm">
      <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">{label}</span>
      <textarea
        id={fieldId}
        {...props}
        className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
      />
    </label>
  );
}
