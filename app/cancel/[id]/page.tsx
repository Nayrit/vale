"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { difficultyCopy, getMerchant } from "@/lib/catalog";
import { formatFull } from "@/lib/dates";
import { shareCut, usd, yearlyOf } from "@/lib/money";
import { useStore } from "@/lib/store";
import { Button, Difficulty, MerchantMark, toast } from "@/components/ui";

export default function CancelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, confirmCancel } = useStore();
  const sub = state.subscriptions.find((s) => s.id === id);
  const merchant = getMerchant(sub?.merchantId);
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState<boolean[]>([]);

  if (!sub) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="serif text-4xl">That charge is gone from the ledger.</h1>
        <Button href="/" className="mt-8">
          Home
        </Button>
      </div>
    );
  }

  const yearly = yearlyOf(sub.amount, sub.cycle);
  const steps = merchant?.cancelSteps ?? [
    {
      title: "Find Account, Billing, or Membership",
      body: `Search “${sub.name} cancel subscription” and prefer the official account page. Avoid the app if the website exists.`,
    },
    {
      title: "Do not pause",
      body: "Pause, freeze, and “remind me later” keep the billing relationship. Cancel.",
      warning: "A discount is still a subscription.",
    },
    {
      title: "Keep proof",
      body: "Screenshot the end date or confirmation number.",
    },
  ];

  if (sub.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-moss">Kept</p>
        <h1 className="serif mt-3 text-5xl leading-tight">
          {sub.name} is over.
          <span className="mt-3 block italic text-moss">{usd(yearly)} a year stays with you.</span>
        </h1>
        <p className="mt-6 text-lg text-muted">
          Cancelled {sub.cancelledAt ? formatFull(sub.cancelledAt) : "today"}. Vale recorded it on Kept.
        </p>
        <div className="mt-10 flex gap-3">
          <Button href="/savings">See what you kept</Button>
          <Button href="/" kind="ghost">
            Home
          </Button>
        </div>
      </div>
    );
  }

  function finish() {
    confirmCancel(sub!.id);
    toast(`${sub!.name} cancelled. ${usd(yearly)} a year stays.`);
    router.push(`/cancel/${sub!.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/subscriptions/${sub.id}`} className="mb-6 flex items-center gap-2 text-[15px] font-medium text-[#1a1713]">
        <span aria-hidden>←</span> {sub.name}
      </Link>
      <div className="mt-6 flex items-start gap-4">
        <MerchantMark merchantId={sub.merchantId} name={sub.name} size="lg" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="serif text-4xl sm:text-5xl">Cancel {sub.name}</h1>
            {merchant ? <Difficulty level={merchant.cancelDifficulty} /> : null}
          </div>
          <p className="mt-3 text-lg text-muted">
            {usd(sub.amount)} / {sub.cycle} · {usd(yearly)} a year
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-2">
        {["The trap", "The door", "The walk"].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.16em] ${
            step === i ? "bg-[#1a1713] text-white" : "bg-white text-[#1a1713] ring-1 ring-[#1a1713]/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <section className="mt-10">
          <p className="serif text-3xl italic leading-snug">
            {merchant
              ? difficultyCopy[merchant.cancelDifficulty]
              : "The door is rarely on the home screen."}
          </p>
          {merchant?.notice ? (
            <p className="mt-5 rounded-3xl bg-clay/10 px-5 py-4 leading-relaxed">{merchant.notice}</p>
          ) : null}
          <ul className="mt-8 grid gap-3">
            {(merchant?.darkPatterns ?? [
              "Pause is offered before cancel.",
              "A smaller bill is offered as generosity. It is still a bill.",
            ]).map((line) => (
              <li key={line} className="rounded-[1.4rem] bg-cream p-5 leading-relaxed ring-1 ring-ink/8">
                {line}
              </li>
            ))}
          </ul>
          <Button className="mt-8" onClick={() => setStep(1)}>
            Show me the door
          </Button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="mt-10">
          <p className="text-muted">
            The bank printed <span className="font-mono text-ink">{sub.bankDescriptor || sub.name}</span>. The
            portal is below.
          </p>
          <div className="mt-6 rounded-[1.8rem] bg-[#2f4a3c] px-6 py-8 text-white">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Open this, not the app</p>
            <p className="serif mt-3 text-3xl italic">{merchant?.name ?? sub.name}</p>
            <p className="mt-2 break-all text-sm text-white/80">
              {merchant?.cancelUrl ?? "Search the official account page"}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {merchant ? (
                <Button href={merchant.cancelUrl} kind="cream">
                  Open cancel page
                </Button>
              ) : null}
              {merchant && merchant.manageUrl !== merchant.cancelUrl ? (
                <Button href={merchant.manageUrl} kind="cream">
                  Manage account
                </Button>
              ) : null}
            </div>
            {merchant?.phone ? <p className="mt-5 text-sm text-cream/80">Phone: {merchant.phone}</p> : null}
          </div>
          <Button className="mt-8" onClick={() => setStep(2)}>
            Walk me through it
          </Button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="mt-10">
          <ol className="grid gap-4">
            {steps.map((item, i) => {
              const on = checks[i] ?? false;
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() =>
                      setChecks((c) => {
                        const next = [...c];
                        next[i] = !on;
                        return next;
                      })
                    }
                    className="w-full rounded-[1.6rem] bg-cream p-5 text-left ring-1 ring-ink/8"
                  >
                    <div className="flex gap-4">
                      <span
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${
                          on ? "bg-[#1a1713] text-white" : "ring-1 ring-[#1a1713]/30"
                        }`}
                      >
                        {on ? "✓" : i + 1}
                      </span>
                      <div>
                        <p className="text-lg">{item.title}</p>
                        <p className="mt-1 leading-relaxed text-muted">{item.body}</p>
                        {item.warning ? (
                          <p className="mt-3 text-sm text-clay">{item.warning}</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-8 rounded-[1.6rem] bg-cream p-5 ring-1 ring-ink/8">
            <p className="text-sm text-muted">If you finish this, Vale records</p>
            <p className="serif mt-1 text-3xl">{usd(yearly)} kept this year</p>
            {state.plan === "share" ? (
              <p className="mt-2 text-sm text-muted">
                Vale Share would take {usd(shareCut(yearly))} of the first year. You keep{" "}
                {usd(yearly - shareCut(yearly))}.
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button kind="clay" onClick={finish}>
              I cancelled
            </Button>
            <Button kind="ghost" onClick={() => router.push("/")}>
              Not yet
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
