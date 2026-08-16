"use client";

import { Button } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function AccountPage() {
  const { state, reset } = useStore();
  const profile = state.profile;

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">You</p>
      <h1 className="serif mt-3 text-5xl">{profile?.name || "Your ledger"}</h1>
      <p className="mt-3 text-lg text-[#3d3830]">{profile?.email}</p>

      <div className="mt-10 rounded-[1.6rem] bg-white p-6 ring-1 ring-[#1a1713]/10">
        <h2 className="serif text-2xl italic">Privacy</h2>
        <ul className="mt-4 grid gap-3 text-[15px] leading-relaxed text-[#1a1713]">
          <li>Vale does not scrape or read your email.</li>
          <li>Vale does not log into Gmail, Outlook, or your bank.</li>
          <li>There is no cloud account. This sign-in lives in this browser only.</li>
          <li>You add charges by pasting a statement or typing them in.</li>
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          kind="ghost"
          onClick={() => {
            if (confirm("Sign out and clear this device’s ledger?")) reset();
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
