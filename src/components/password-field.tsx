"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
};

export function PasswordField({ label, value, onChange, autoComplete, minLength, required = false }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const VisibilityIcon = visible ? EyeOff : Eye;

  return <div className="field password-field">
    <label htmlFor={id}>{label}</label>
    <span className="password-input-wrap">
      <input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      <button className="password-visibility-toggle" type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={id} onClick={() => setVisible((current) => !current)}>
        <VisibilityIcon size={18} aria-hidden="true" />
      </button>
    </span>
  </div>;
}
