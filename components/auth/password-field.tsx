"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-[#1a1713]">{label}</span>
      <span className="relative block">
        <input
          className={`${inputClass} pr-20`}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#3d3830]"
          onClick={() => setShow((s) => !s)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

export function PasswordHint({ password }: { password: string }) {
  if (!password) return null;
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  const label = score <= 1 ? "Too light" : score === 2 ? "Alright" : score === 3 ? "Strong" : "Very strong";
  return (
    <p className="text-xs text-[#3d3830]">
      {label}
      {password.length < 8 ? " — 8 characters minimum." : ""}
    </p>
  );
}
