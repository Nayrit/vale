"use client";

import Link from "next/link";
import { getMerchant } from "@/lib/catalog";
import { daysSince, unusedCopy } from "@/lib/dates";
import { cycleLabel, usd } from "@/lib/money";
import type { Subscription } from "@/lib/types";
import { Difficulty, MerchantMark } from "@/components/ui";

export function SubCard({
  sub,
}: {
  sub: Subscription;
  quiet?: boolean;
}) {
  const merchant = getMerchant(sub.merchantId);
  const days = daysSince(sub.lastUsedAt);

  return (
    <article className="grid gap-4 rounded-[1.75rem] bg-cream/70 p-5 ring-1 ring-ink/8 transition duration-300 hover:-translate-y-0.5 hover:bg-cream hover:shadow-[0_20px_50px_-28px_rgba(26,23,18,0.35)] sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <Link href={`/subscriptions/${sub.id}`} className="flex min-w-0 items-center gap-4 sm:contents">
        <MerchantMark merchantId={sub.merchantId} name={sub.name} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg">{sub.name}</h3>
            {merchant ? <Difficulty level={merchant.cancelDifficulty} /> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {sub.source === "inbox" ? <span className="mr-2">From inbox</span> : null}
            {sub.bankDescriptor ? (
              <span className="mr-2 font-mono text-[11px] tracking-wide">{sub.bankDescriptor}</span>
            ) : null}
            {days == null ? "never marked as used" : unusedCopy(days)}
          </p>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <p className="serif text-2xl leading-none">
          {sub.amount === 0 ? (
            "Free"
          ) : (
            <>
              {usd(sub.amount)}
              <span className="ml-1 text-sm not-italic text-muted">/{cycleLabel(sub.cycle)}</span>
            </>
          )}
        </p>
        {sub.status === "cancelled" ? (
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">ended</p>
        ) : (
          <Link
            href={`/cancel/${sub.id}`}
            className="rounded-full bg-[#b44528] px-3 py-1 text-[11px] uppercase tracking-[0.16em]"
            style={{ color: "#ffffff" }}
          >
            Cancel
          </Link>
        )}
      </div>
    </article>
  );
}
