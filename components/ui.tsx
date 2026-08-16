"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { BillingCycle } from "@/lib/types";
import { difficultyCopy, getMerchant } from "@/lib/catalog";
import { usd } from "@/lib/money";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("vale-toast", { detail: message }));
}

export function Mark({
  name,
  color,
  letter,
  size = "md",
}: {
  name: string;
  color?: string;
  letter?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  return (
    <span
      className={`serif grid shrink-0 place-items-center rounded-full text-cream ${dim}`}
      style={{ background: color || "#2C4A3C" }}
      aria-hidden
    >
      {letter || name.slice(0, 1)}
    </span>
  );
}

export function MerchantMark({
  merchantId,
  name,
  size,
}: {
  merchantId?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const m = getMerchant(merchantId);
  return <Mark name={m?.name || name} color={m?.color} letter={m?.letter} size={size} />;
}

export function Money({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return <span className={`tabular-nums ${className}`}>{usd(value)}</span>;
}

export function Button({
  children,
  href,
  onClick,
  kind = "ink",
  type = "button",
  className = "",
  disabled,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  kind?: "ink" | "ghost" | "clay" | "cream";
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  const styles = {
    ink: "bg-moss text-cream hover:bg-moss-2",
    ghost: "bg-transparent text-ink ring-1 ring-ink/12 hover:bg-ink/5",
    clay: "bg-clay text-cream hover:brightness-110",
    cream: "bg-cream text-ink ring-1 ring-ink/8 hover:bg-white",
  }[kind];
  const cls = `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm tracking-wide transition duration-300 disabled:opacity-40 ${styles} ${className}`;
  if (href) {
    if (href.startsWith("http")) {
      return (
        <a href={href} className={cls} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl bg-cream px-4 py-3 text-ink outline-none ring-1 ring-ink/10 transition focus:ring-moss/40";

export function Difficulty({ level }: { level: "easy" | "medium" | "hard" | "hostile" }) {
  const tone = {
    easy: "text-moss bg-moss/8",
    medium: "text-gold bg-gold/10",
    hard: "text-clay bg-clay/10",
    hostile: "text-clay bg-clay/15",
  }[level];
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${tone}`}>
      {level}
    </span>
  );
}

export function DifficultyLine({ level }: { level: "easy" | "medium" | "hard" | "hostile" }) {
  return (
    <p className="text-sm leading-relaxed text-muted">
      <span className="text-ink">{level[0].toUpperCase() + level.slice(1)}.</span> {difficultyCopy[level]}
    </p>
  );
}

export function CycleSelect({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (v: BillingCycle) => void;
}) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as BillingCycle)}>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
      <option value="yearly">Yearly</option>
    </select>
  );
}

export function SectionTitle({
  kicker,
  title,
  aside,
}: {
  kicker?: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? (
          <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted">{kicker}</p>
        ) : null}
        <h2 className="serif text-3xl italic leading-none">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
