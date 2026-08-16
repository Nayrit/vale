"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CATEGORIES, searchMerchants } from "@/lib/catalog";
import { cycleLabel, usd } from "@/lib/money";
import { Difficulty, Mark, inputClass } from "@/components/ui";
import type { Category } from "@/lib/types";

export default function CatalogPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const list = useMemo(() => {
    const found = searchMerchants(q);
    return cat === "all" ? found : found.filter((m) => m.category === cat);
  }, [q, cat]);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted">The missing portals</p>
      <h1 className="serif mt-3 text-5xl leading-tight sm:text-6xl">
        Where to cancel
        <span className="italic text-moss"> — on purpose.</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted">
        Forty doors, with the dark patterns named in advance. Difficulty is honest. Gyms are hostile because they are.
      </p>

      <input
        className={`${inputClass} mt-10`}
        placeholder="Search Netflix, gym, Apple.com/bill…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {list.map((m) => (
          <Link
            key={m.id}
            href={`/add?merchant=${m.id}`}
            className="flex gap-4 rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8 transition hover:-translate-y-0.5 hover:bg-cream"
          >
            <Mark name={m.name} color={m.color} letter={m.letter} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg">{m.name}</h2>
                <Difficulty level={m.cancelDifficulty} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {usd(m.typicalPrice)}/{cycleLabel(m.cycle)} · {m.aliases[0]}
              </p>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{m.darkPatterns[0]}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs tracking-wide ${
        active ? "bg-ink text-cream" : "bg-cream text-muted ring-1 ring-ink/8"
      }`}
    >
      {children}
    </button>
  );
}
