"use client";

import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type FieldProps = { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>;

export function FormField({ label, hint, id, type, ...props }: FieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1.5 font-body text-sm">
      <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">{label}</span>
      {isPassword ? (
        <div className="relative">
          <input
            id={fieldId}
            type={visible ? "text" : "password"}
            {...props}
            className="w-full rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 pr-16 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="transition-standard absolute top-1/2 right-3 -translate-y-1/2 font-tag text-[0.65rem] uppercase tracking-widest text-ink/50 hover:text-pine"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      ) : (
        <input
          id={fieldId}
          type={type}
          {...props}
          className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
        />
      )}
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
