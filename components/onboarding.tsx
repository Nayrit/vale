"use client";

import { FormEvent, useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { useStore } from "@/lib/store";

export function Onboarding() {
  const { startDemo, startEmpty } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function profile() {
    const n = name.trim();
    const e = email.trim();
    if (!n || !e || !e.includes("@")) {
      setError("Add your name and email to create the ledger.");
      return null;
    }
    return { name: n, email: e };
  }

  function onDemo(e: FormEvent) {
    e.preventDefault();
    const p = profile();
    if (p) startDemo(p);
  }

  function onEmpty() {
    const p = profile();
    if (p) startEmpty(p);
  }

  return (
    <div className="relative z-10 min-h-screen overflow-hidden px-6 py-16 sm:px-12">
      <div className="mx-auto grid min-h-[80vh] max-w-5xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">
            Create your ledger
          </p>
          <h1 className="serif mt-5 text-6xl leading-[0.92] sm:text-8xl">
            Vale<span className="italic text-[#2f4a3c]">.</span>
          </h1>
          <p className="mt-8 max-w-xl text-xl leading-relaxed text-[#1a1713] sm:text-2xl">
            Vale never reads your email. It does not connect to Gmail, your bank, or the cloud.
          </p>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#3d3830]">
            You paste lines from a statement, or add a charge by hand. The cancel page comes from Vale’s catalog — not from your inbox.
          </p>
        </div>

        <form
          onSubmit={onDemo}
          className="rounded-[2rem] bg-white p-8 shadow-[0_24px_60px_-32px_rgba(26,23,18,0.35)] ring-1 ring-[#1a1713]/10"
        >
          <h2 className="serif text-3xl">Sign in locally</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#3d3830]">
            Name and email stay on this device. Nothing is uploaded, so there is no Google login to grant.
          </p>
          <div className="mt-8 grid gap-4">
            <Field label="Your name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Ada"
              />
            </Field>
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="ada@example.com"
              />
            </Field>
          </div>
          {error ? <p className="mt-4 text-sm font-medium text-[#b44528]">{error}</p> : null}
          <div className="mt-8 grid gap-3">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#1a1713] px-5 py-3.5 text-[15px] font-medium text-white"
            >
              Sign in with a sample household
            </button>
            <button
              type="button"
              onClick={onEmpty}
              className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3.5 text-[15px] font-medium text-[#1a1713] ring-2 ring-[#1a1713]"
            >
              Sign in with an empty ledger
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
