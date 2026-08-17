"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui";

export default function AccountPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">You</p>
      <h1 className="serif mt-3 text-5xl">{user?.name || "Your ledger"}</h1>
      <p className="mt-3 text-lg text-[#3d3830]">{user?.email}</p>
      <p className="mt-2 text-sm text-[#3d3830]">
        {user?.provider === "google" ? "Signed in with Google" : "Signed in with email"}
      </p>

      <div className="mt-10 rounded-[1.6rem] bg-white p-6 ring-1 ring-[#1a1713]/10">
        <h2 className="serif text-2xl italic">Inbox</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#1a1713]">
          Optional. Vale only reads billing mail if you allow it. Access is read-only, for this address, and you choose
          what lands on the ledger. A statement paste is the complete free list of what the bank actually charged.
        </p>
        <Button href="/inbox" className="mt-5">
          Scan this inbox
        </Button>
      </div>

      <div className="mt-6 rounded-[1.6rem] bg-white p-6 ring-1 ring-[#1a1713]/10">
        <h2 className="serif text-2xl italic">Privacy</h2>
        <ul className="mt-4 grid gap-3 text-[15px] leading-relaxed text-[#1a1713]">
          <li>Nothing is scraped until you press Allow on the inbox screen.</li>
          <li>Gmail access is read-only. Vale cannot send, delete, or change mail.</li>
          <li>Your password never leaves this browser. There is no Vale server for this module.</li>
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button kind="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
