"use client";

import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  label: string;
  hint?: string;
  /** Shown instead of the browser's generic "Please fill out this field" when left empty. */
  requiredMessage?: string;
  /** Shown instead of the browser's generic format message (e.g. for type="email"). */
  invalidMessage?: string;
} & InputHTMLAttributes<HTMLInputElement>;

function applyCustomValidity(
  target: HTMLInputElement | HTMLTextAreaElement,
  label: string,
  requiredMessage?: string,
  invalidMessage?: string
) {
  if (target.validity.valueMissing) {
    target.setCustomValidity(requiredMessage ?? `Please fill in ${label.toLowerCase()}.`);
  } else if (target.validity.typeMismatch || target.validity.patternMismatch) {
    target.setCustomValidity(invalidMessage ?? `Please enter a valid ${label.toLowerCase()}.`);
  } else if (target.validity.tooShort) {
    target.setCustomValidity(`${label} must be at least ${target.minLength} characters.`);
  } else {
    target.setCustomValidity("");
  }
}

export function FormField({
  label,
  hint,
  id,
  type,
  requiredMessage,
  invalidMessage,
  onInvalid,
  onChange,
  ...props
}: FieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  function handleInvalid(event: FormEvent<HTMLInputElement>) {
    applyCustomValidity(event.currentTarget, label, requiredMessage, invalidMessage);
    onInvalid?.(event);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    event.currentTarget.setCustomValidity("");
    onChange?.(event);
  }

  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1.5 font-body text-sm">
      <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">{label}</span>
      {isPassword ? (
        <div className="relative">
          <input
            id={fieldId}
            type={visible ? "text" : "password"}
            onInvalid={handleInvalid}
            onChange={handleChange}
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
          onInvalid={handleInvalid}
          onChange={handleChange}
          {...props}
          className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
        />
      )}
      {hint && <span className="font-body text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

type TextareaProps = {
  label: string;
  requiredMessage?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function FormTextarea({ label, id, requiredMessage, onInvalid, onChange, ...props }: TextareaProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  function handleInvalid(event: FormEvent<HTMLTextAreaElement>) {
    applyCustomValidity(event.currentTarget, label, requiredMessage);
    onInvalid?.(event);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    event.currentTarget.setCustomValidity("");
    onChange?.(event);
  }

  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1.5 font-body text-sm">
      <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">{label}</span>
      <textarea
        id={fieldId}
        onInvalid={handleInvalid}
        onChange={handleChange}
        {...props}
        className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
      />
    </label>
  );
}
