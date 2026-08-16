"use client";

import { useParams, useRouter } from "next/navigation";
import { getMerchant } from "@/lib/catalog";
import { daysSince, formatDay, unusedCopy } from "@/lib/dates";
import { cycleLabel, monthlyOfSub, usd, yearlyOf } from "@/lib/money";
import { isQuiet, useStore } from "@/lib/store";
import { Button, Difficulty, MerchantMark, toast } from "@/components/ui";

export default function SubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, markUsed, removeSubscription, restore } = useStore();
  const sub = state.subscriptions.find((s) => s.id === id);

  if (!sub) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="serif text-4xl">Gone from the ledger.</h1>
        <Button href="/" kind="ghost" className="mt-6">
          Home
        </Button>
      </div>
    );
  }

  const merchant = getMerchant(sub.merchantId);
  const quiet = isQuiet(sub, state.unusedDays);
  const ended = sub.status === "cancelled";
  const days = daysSince(sub.lastUsedAt);
  const yearly = yearlyOf(sub.amount, sub.cycle);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">Charge</p>
      <div className="mt-6 flex flex-wrap items-start gap-5">
        <MerchantMark merchantId={sub.merchantId} name={sub.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="serif text-5xl leading-none">{sub.name}</h1>
            {merchant ? <Difficulty level={merchant.cancelDifficulty} /> : null}
          </div>
          <p className="serif mt-4 text-4xl">
            {usd(sub.amount)}
            <span className="ml-2 text-base text-muted">
              /{cycleLabel(sub.cycle)} · {usd(yearly)} a year
            </span>
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Use</p>
          <p className="mt-2 text-lg">{days == null ? "Never marked" : unusedCopy(days)}</p>
        </div>
        <div className="rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
            {ended ? "Ended" : "Next charge"}
          </p>
          <p className="mt-2 text-lg">{ended ? "No further draft" : formatDay(sub.nextChargeAt)}</p>
        </div>
        <div className="rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Monthly</p>
          <p className="serif mt-2 text-2xl">{usd(monthlyOfSub(sub))}</p>
        </div>
      </div>

      {sub.bankDescriptor ? (
        <p className="mt-6 font-mono text-sm text-muted">
          {sub.source === "inbox" ? "Inbox showed" : "Bank shows"} {sub.bankDescriptor}
        </p>
      ) : null}

      {merchant?.notice ? (
        <p className="mt-6 max-w-xl rounded-3xl bg-clay/10 px-5 py-4 leading-relaxed">{merchant.notice}</p>
      ) : null}

      {merchant && merchant.darkPatterns.length > 0 && !ended ? (
        <div className="mt-8 max-w-xl rounded-[1.6rem] bg-cream/80 p-5 ring-1 ring-ink/8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Dark patterns</p>
          <ul className="mt-3 grid gap-2 text-[15px] leading-relaxed text-muted">
            {merchant.darkPatterns.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quiet && !ended ? (
        <p className="mt-8 max-w-xl text-lg text-clay">
          Quiet for {state.unusedDays}+ days and still leaving {usd(yearly)} a year.
        </p>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3">
        {!ended ? (
          <Button href={`/cancel/${sub.id}`} kind="clay">
            Walk the cancel
          </Button>
        ) : (
          <Button href="/savings">See what you kept</Button>
        )}
        {!ended ? (
          <Button
            kind="ghost"
            onClick={() => {
              markUsed(sub.id);
              toast(`Marked ${sub.name} as used today.`);
            }}
          >
            I used this today
          </Button>
        ) : (
          <Button kind="ghost" onClick={() => restore(sub.id)}>
            Restore
          </Button>
        )}
        {merchant ? (
          <Button href={merchant.manageUrl} kind="ghost">
            Account
          </Button>
        ) : null}
        <Button
          kind="ghost"
          onClick={() => {
            if (confirm(`Remove ${sub.name} from the ledger?`)) {
              removeSubscription(sub.id);
              router.push("/");
            }
          }}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
