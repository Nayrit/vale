"use client";

import { shareCut, usd } from "@/lib/money";
import { formatDay } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";

export default function SavingsPage() {
  const { state, setPlan, setUnusedDays, reset } = useStore();
  const monthly = state.savings.reduce((n, e) => n + e.monthlyAmount, 0);
  const yearly = monthly * 12;
  const fee = shareCut(yearly);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted">What stayed</p>
      <h1 className="serif mt-3 text-5xl leading-[0.92] sm:text-7xl">
        {usd(yearly)}
        <span className="mt-3 block text-2xl italic text-muted sm:text-3xl">
          a year, from doors you closed
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        Vale never bills you. Plans below are labels on this device — Free is the whole product. Plus and Share do
        not take a payment; they only change how unused days are counted on this browser.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Each month</p>
          <p className="serif mt-3 text-3xl">{usd(monthly)}</p>
        </div>
        <div className="rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Cancellations</p>
          <p className="serif mt-3 text-3xl">{state.savings.length}</p>
        </div>
        <div className="rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Plan</p>
          <p className="serif mt-3 text-3xl capitalize">{state.plan}</p>
        </div>
      </div>

      <section className="mt-16">
        <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted">Ledger</p>
        <h2 className="serif mb-6 text-3xl italic">Closed</h2>
        {state.savings.length === 0 ? (
          <p className="text-muted">Nothing kept yet. Cancel something quiet and it will land here.</p>
        ) : (
          <ul className="grid gap-2">
            {state.savings.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-4 rounded-[1.4rem] bg-cream/80 px-5 py-4 ring-1 ring-ink/8"
              >
                <div>
                  <p className="text-lg">{e.name}</p>
                  <p className="text-sm text-muted">{formatDay(e.cancelledAt)}</p>
                </div>
                <p className="serif text-2xl text-moss">{usd(e.monthlyAmount * 12)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16">
        <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted">How Vale stays alive</p>
        <h2 className="serif mb-6 text-3xl italic">Plans</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <PlanCard
            name="Free"
            price="Nothing"
            body="Ledger, statement matching, inbox scan, every door, and the cancel walk. No payment."
            current={state.plan === "free"}
            onPick={() => setPlan("free")}
          />
          <PlanCard
            name="Plus"
            price="$6 / month"
            body="On this device only. Tighten when unused becomes a problem. Nothing is charged."
            current={state.plan === "plus"}
            onPick={() => setPlan("plus")}
          />
          <PlanCard
            name="Share"
            price="15% of year one"
            body={
              yearly > 0
                ? `A label only: Vale would show ${usd(fee)} as 15% of year one. Nothing is charged. You keep the full ${usd(yearly)}.`
                : "A label only. After you cancel, Vale would show 15% of year one. Nothing is charged."
            }
            current={state.plan === "share"}
            onPick={() => setPlan("share")}
          />
        </div>
      </section>

      <section className="mt-12 rounded-[1.8rem] bg-cream/80 p-6 ring-1 ring-ink/8 sm:p-8">
        <h2 className="serif text-3xl italic">Quiet, defined</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
          {state.plan === "plus" || state.plan === "share"
            ? "You can decide when unused becomes a problem."
            : "Free watches for 60 days of silence. Changing the window labels this device Plus — still no payment."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[30, 45, 60, 90].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                if (state.plan === "free" && n !== 60) setPlan("plus");
                setUnusedDays(n);
              }}
              className={`rounded-full px-4 py-2 text-sm ${
                state.unusedDays === n ? "bg-ink text-cream" : "bg-paper text-muted ring-1 ring-ink/10"
              }`}
            >
              {n} days
            </button>
          ))}
        </div>
        <Button
          kind="ghost"
          className="mt-8"
          onClick={() => {
            if (confirm("Clear this device and return to the first page?")) reset();
          }}
        >
          Start over
        </Button>
      </section>
    </div>
  );
}

function PlanCard({
  name,
  price,
  body,
  current,
  onPick,
}: {
  name: string;
  price: string;
  body: string;
  current: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`rounded-[1.6rem] bg-cream p-5 text-left ring-1 transition hover:-translate-y-0.5 ${
        current ? "ring-ink" : "ring-ink/8"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
        {current ? "Current" : "Plan"}
      </p>
      <h3 className="serif mt-2 text-3xl">{name}</h3>
      <p className="mt-1 text-sm text-gold">{price}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </button>
  );
}
