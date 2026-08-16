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
        <h2 className="serif text-2xl italic">Privacy</h2>
        <ul className="mt-4 grid gap-3 text-[15px] leading-relaxed text-[#1a1713]">
          <li>Vale does not scrape or read your email.</li>
          <li>Google sign-in only receives your name and email. It cannot open Gmail.</li>
          <li>Your password never leaves this browser. There is no Vale server for this module.</li>
          <li>You add charges by pasting a statement or typing them in.</li>
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
