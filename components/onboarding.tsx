"use client";

import { useAuth } from "@/components/auth-provider";
import { useStore } from "@/lib/store";

export function Onboarding() {
  const { startDemo, startEmpty } = useStore();
  const { user } = useAuth();

  return (
    <div className="relative z-10 min-h-screen px-6 py-16 sm:px-12">
      <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">
          Signed in as {user?.email}
        </p>
        <h1 className="serif mt-5 text-5xl leading-tight sm:text-6xl">How should this ledger start?</h1>
        <p className="mt-5 text-lg leading-relaxed text-[#3d3830]">
          A sample household is the fastest way to see Vale. An empty ledger waits for your own charges.
        </p>
        <div className="mt-10 grid gap-3">
          <button
            type="button"
            onClick={startDemo}
            className="rounded-full bg-[#1a1713] px-5 py-3.5 text-[15px] font-medium"
            style={{ color: "#ffffff" }}
          >
            Open a sample household
          </button>
          <button
            type="button"
            onClick={startEmpty}
            className="rounded-full bg-white px-5 py-3.5 text-[15px] font-medium ring-2 ring-[#1a1713]"
            style={{ color: "#1a1713" }}
          >
            Start empty
          </button>
        </div>
      </div>
    </div>
  );
}
