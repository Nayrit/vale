"use client";

import { Button } from "@/components/ui";
import { useStore } from "@/lib/store";

export function Onboarding() {
  const { startDemo, startEmpty } = useStore();

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-16 sm:px-12">
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-moss/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-96 w-96 rounded-full bg-clay/10 blur-3xl" />
      <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center">
        <p className="rise text-[11px] uppercase tracking-[0.28em] text-muted">Subscription steward</p>
        <h1 className="serif rise-2 mt-6 text-6xl leading-[0.92] sm:text-8xl">
          Vale<span className="italic text-moss">.</span>
        </h1>
        <p className="rise-3 mt-8 max-w-xl text-xl leading-relaxed text-muted sm:text-2xl">
          Your bank names the charge. It never names the door. Companies hide cancel behind pause, freeze, and a smaller bill.
        </p>
        <div className="rise-3 mt-12 flex flex-col gap-3 sm:flex-row">
          <Button onClick={startDemo} className="px-7 py-3.5">
            Open a lived-in household
          </Button>
          <Button kind="ghost" onClick={startEmpty} className="px-7 py-3.5">
            Start from a blank ledger
          </Button>
        </div>
        <p className="mt-10 max-w-md text-sm leading-relaxed text-muted">
          The household is a realistic set of quiet subscriptions — streaming, a gym, software you stopped opening. Nothing leaves this browser. There is no account to create.
        </p>
      </div>
    </div>
  );
}
