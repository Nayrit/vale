"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function AuthFrame({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-12 lg:grid-cols-[1fr_26rem]">
        <div className="hidden lg:block">
          <Link href="/login" className="serif text-5xl italic text-[#1a1713]">
            Vale
          </Link>
          <p className="mt-8 max-w-md text-2xl leading-snug text-[#1a1713]">{lede}</p>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#3d3830]">
            Vale does not read your inbox. Google is only used to sign you in — never to scan mail or find subscriptions.
          </p>
        </div>
        <div>
          <Link href="/login" className="serif mb-8 block text-4xl italic lg:hidden">
            Vale
          </Link>
          <div className="rounded-[2rem] bg-white p-7 shadow-[0_24px_60px_-32px_rgba(26,23,18,0.35)] ring-1 ring-[#1a1713]/10 sm:p-8">
            <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-[#3d3830]">{kicker}</p>
            <h1 className="serif mt-2 text-3xl sm:text-4xl">{title}</h1>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrLine() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-[#3d3830]">
      <span className="h-px flex-1 bg-[#1a1713]/15" />
      or
      <span className="h-px flex-1 bg-[#1a1713]/15" />
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-2xl bg-[#b44528]/10 px-4 py-3 text-sm font-medium text-[#9a3a22]" role="alert">
      {message}
    </p>
  );
}

export const authBtn =
  "inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-[15px] font-medium disabled:opacity-40";
