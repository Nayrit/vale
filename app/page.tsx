"use client";

import { CATEGORIES, getMerchant } from "@/lib/catalog";
import { daysSince, formatDay, monthName } from "@/lib/dates";
import { monthlyOfSub, usd } from "@/lib/money";
import { isQuiet, useStore } from "@/lib/store";
import { SubCard } from "@/components/sub-card";
import { Button } from "@/components/ui";
import Link from "next/link";

export default function HomePage() {
  const { state } = useStore();
  const active = state.subscriptions.filter((s) => s.status !== "cancelled");
  const quiet = active.filter((s) => isQuiet(s, state.unusedDays));
  const alive = active.filter((s) => !isQuiet(s, state.unusedDays));
  const monthly = active.reduce((sum, s) => sum + monthlyOfSub(s), 0);
  const yearly = monthly * 12;
  const quietMonthly = quiet.reduce((sum, s) => sum + monthlyOfSub(s), 0);
  const keptYearly = state.savings.reduce((sum, e) => sum + e.monthlyAmount * 12, 0);
  const upcoming = active
    .filter((s) => {
      const delta = daysSince(s.nextChargeAt);
      return delta != null && delta <= 0 && delta >= -10;
    })
    .sort((a, b) => a.nextChargeAt.localeCompare(b.nextChargeAt));

  const byCat = new Map<string, number>();
  for (const sub of active) {
    const cat = getMerchant(sub.merchantId)?.category ?? "other";
    byCat.set(cat, (byCat.get(cat) ?? 0) + monthlyOfSub(sub));
  }
  const bars = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted">{monthName()}</p>
      <h1 className="serif rise mt-3 text-5xl leading-[0.92] sm:text-7xl">
        {usd(monthly)}
        <span className="mt-3 block text-2xl italic text-muted sm:text-3xl">still leaving each month</span>
      </h1>
      <p className="rise-2 mt-6 max-w-xl text-lg leading-relaxed text-muted">
        {quiet.length === 0
          ? "Nothing looks abandoned. Mark last-used dates so Vale can see the quiet ones."
          : `${quiet.length === 1 ? "One subscription has" : `${quiet.length} subscriptions have`} been quiet for ${state.unusedDays}+ days — ${usd(quietMonthly)} a month, ${usd(quietMonthly * 12)} a year if they stay.`}
      </p>

      {state.inboxPrompt !== "allowed" && active.length > 0 ? (
        <div className="rise-3 mt-10 rounded-[1.8rem] bg-white p-6 ring-1 ring-[#1a1713]/10 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="serif text-2xl italic">Optional: billed mail</p>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-[#3d3830]">
              Vale can look for Stripe, PayPal, and Google payment receipts in this Gmail. It only adds a charge when
              the mail proves a recurring bill — never a guessed catalog price.
            </p>
          </div>
          <Button href="/inbox" className="mt-4 shrink-0 sm:mt-0">
            Scan inbox
          </Button>
        </div>
      ) : null}

      <div className="rise-3 mt-10 grid gap-3 sm:grid-cols-3">
        <Stat label="This year if nothing changes" value={usd(yearly)} />
        <Stat label="Quiet money" value={usd(quietMonthly * 12)} hint="annualized" />
        <Stat label="Already kept" value={usd(keptYearly)} hint="first-year savings" />
      </div>

      {bars.length > 0 ? (
        <div className="mt-12">
          <div className="flex h-2 overflow-hidden rounded-full bg-ink/5">
            {bars.map(([cat, n]) => (
              <div
                key={cat}
                style={{ width: `${monthly ? (n / monthly) * 100 : 0}%`, background: barColor(cat) }}
                title={`${cat} ${usd(n)}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-muted">
            {bars.map(([cat, n]) => (
              <span key={cat}>
                {CATEGORIES.find((c) => c.id === cat)?.label ?? cat} {usd(n)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mt-16">
          <p className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted">Charging soon</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcoming.map((sub) => (
              <Link
                key={sub.id}
                href={`/cancel/${sub.id}`}
                className="min-w-[11.5rem] rounded-3xl bg-cream p-4 ring-1 ring-ink/8"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-clay">{formatDay(sub.nextChargeAt)}</p>
                <p className="mt-2">{sub.name}</p>
                <p className="serif mt-1 text-xl">{usd(sub.amount)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {active.length === 0 ? (
        <div className="mt-16 rounded-[2rem] bg-white p-10 ring-1 ring-[#1a1713]/10">
          <p className="serif text-4xl italic">A quiet ledger</p>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#3d3830]">
            Start with a bank or card statement — that is the free, complete list of what actually left the account.
            Inbox scan is optional proof of mailed bills. You can also add one by hand.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/import">Paste a statement</Button>
            <Button href="/add" kind="ghost">
              Add one by hand
            </Button>
            <Button href="/inbox" kind="ghost">
              {state.inboxPrompt === "allowed" ? "Scan inbox again" : "Scan Gmail (optional)"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {quiet.length > 0 ? (
            <section className="mt-16">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-clay">The quiet ones</p>
                  <h2 className="serif text-3xl italic">Untouched</h2>
                </div>
                <p className="text-sm text-muted">{usd(quietMonthly)} / month</p>
              </div>
              <div className="grid gap-3">
                {quiet.map((sub) => (
                  <SubCard key={sub.id} sub={sub} quiet />
                ))}
              </div>
            </section>
          ) : null}

          {alive.length > 0 ? (
            <section className="mt-16">
              <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted">Still in the room</p>
              <h2 className="serif mb-6 text-3xl italic">In use</h2>
              <div className="grid gap-3">
                {alive.map((sub) => (
                  <SubCard key={sub.id} sub={sub} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="serif mt-3 text-3xl leading-none">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function barColor(cat: string) {
  const map: Record<string, string> = {
    streaming: "#2C4A3C",
    fitness: "#C45C38",
    software: "#1E3A8A",
    ai: "#1A1712",
    news: "#A57C3C",
    music: "#3F5E4D",
    shopping: "#B45309",
    food: "#65A30D",
    cloud: "#6366F1",
    gaming: "#1D4ED8",
    other: "#6A6458",
  };
  return map[cat] ?? "#6A6458";
}
