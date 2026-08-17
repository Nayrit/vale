"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SAMPLE_STATEMENT, parseStatement } from "@/lib/match";
import { usd } from "@/lib/money";
import { useStore } from "@/lib/store";
import { Button, Difficulty, MerchantMark, inputClass, toast } from "@/components/ui";
import type { StatementMatch } from "@/lib/types";

export default function ImportPage() {
  const router = useRouter();
  const { state, importMatches } = useStore();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const matches = useMemo(() => parseStatement(text), [text]);
  const subscriptions = matches.filter((m) => m.kind === "subscription");
  const purchases = matches.filter((m) => m.kind === "purchase");

  function isOn(i: number, match: StatementMatch) {
    return selected[i] ?? match.kind === "subscription";
  }

  function toggle(i: number) {
    const match = matches[i];
    setSelected((s) => ({ ...s, [i]: !isOn(i, match) }));
  }

  function add() {
    const chosen = matches.filter((m, i) => m.amount != null && isOn(i, m));
    const n = importMatches(chosen);
    toast(n ? `Added ${n} subscription${n === 1 ? "" : "s"}.` : "Those were already on the ledger.");
    router.push("/");
  }

  const chosenCount = matches.filter((m, i) => m.amount != null && isOn(i, m)).length;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Bank → door</p>
      <h1 className="serif mt-3 text-5xl leading-tight sm:text-6xl">
        Paste the statement.
        <span className="mt-2 block italic text-moss">Vale keeps the recurring ones.</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#3d3830]">
        Download a CSV from your bank or card, or copy lines from the website. Vale matches catalog names like
        NETFLIX.COM to the cancel page, and treats a one-time shop charge as a purchase — not a monthly sub.
      </p>

      <textarea
        className={`${inputClass} mt-10 min-h-48 font-mono text-sm`}
        placeholder="08/01 NETFLIX.COM 17.99"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSelected({});
        }}
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          kind="ghost"
          onClick={() => {
            setText(SAMPLE_STATEMENT);
            setSelected({});
          }}
        >
          Use a sample statement
        </Button>
        <Button onClick={add} disabled={chosenCount === 0}>
          Add {chosenCount || "the"} subscription{chosenCount === 1 ? "" : "s"}
        </Button>
      </div>

      {text.trim() ? (
        <>
          {subscriptions.length > 0 ? (
            <section className="mt-10">
              <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-muted">Looks recurring</p>
              <ul className="grid gap-3">
                {matches.map((match, i) =>
                  match.kind === "subscription" ? (
                    <MatchRow
                      key={`${match.raw}-${i}`}
                      match={match}
                      already={alreadyOnLedger(state.subscriptions, match)}
                      on={isOn(i, match)}
                      onToggle={() => toggle(i)}
                    />
                  ) : null,
                )}
              </ul>
            </section>
          ) : null}

          {purchases.length > 0 ? (
            <section className="mt-10">
              <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted">Looks like a purchase</p>
              <p className="mb-3 max-w-lg text-sm leading-relaxed text-[#3d3830]">
                One-time lines stay off the ledger unless you check them. A marketplace order is not Netflix.
              </p>
              <ul className="grid gap-3">
                {matches.map((match, i) =>
                  match.kind === "purchase" ? (
                    <MatchRow
                      key={`${match.raw}-${i}`}
                      match={match}
                      already={alreadyOnLedger(state.subscriptions, match)}
                      on={isOn(i, match)}
                      onToggle={() => toggle(i)}
                    />
                  ) : null,
                )}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className="mt-12 max-w-lg text-sm leading-relaxed text-muted">
          Tip: APPLE.COM/BILL is not a service. It is a hallway. Vale opens Apple’s subscription list so you can see
          which apps are hiding inside one charge.
        </p>
      )}
    </div>
  );
}

function alreadyOnLedger(
  subscriptions: { status: string; merchantId: string | null; name: string }[],
  match: StatementMatch,
) {
  const key = match.merchant?.id || (match.descriptor || "").trim().toLowerCase();
  return subscriptions.some((s) => {
    if (s.status === "cancelled") return false;
    if (match.merchant) return s.merchantId === match.merchant.id;
    return s.name.trim().toLowerCase() === key;
  });
}

function MatchRow({
  match,
  already,
  on,
  onToggle,
}: {
  match: StatementMatch;
  already: boolean;
  on: boolean;
  onToggle: () => void;
}) {
  const canAdd = match.amount != null;
  return (
    <li
      className={`flex flex-wrap items-center gap-4 rounded-[1.6rem] bg-cream/80 p-4 ring-1 ring-ink/8 ${
        match.kind === "purchase" ? "opacity-80" : ""
      }`}
    >
      {canAdd ? (
        <button
          type="button"
          onClick={onToggle}
          className={`grid h-6 w-6 place-items-center rounded-full ring-1 ${
            on && !already ? "bg-moss text-cream ring-moss" : "ring-ink/20"
          }`}
          aria-label="Toggle"
        >
          {on && !already ? "✓" : ""}
        </button>
      ) : (
        <span className="grid h-6 w-6 place-items-center text-xs text-muted">—</span>
      )}
      {match.merchant ? (
        <MerchantMark merchantId={match.merchant.id} name={match.merchant.name} size="sm" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-xs">?</span>
      )}
      <div className="min-w-0 flex-1">
        <p>
          {match.merchant ? match.merchant.name : match.descriptor || "Unknown merchant"}
          {already ? <span className="ml-2 text-xs text-muted">already on ledger</span> : null}
          {match.kind === "purchase" ? (
            <span className="ml-2 text-xs text-muted">purchase</span>
          ) : (
            <span className="ml-2 text-xs text-muted">subscription</span>
          )}
        </p>
        <p className="truncate font-mono text-[11px] text-muted">{match.descriptor || match.raw}</p>
      </div>
      {match.merchant ? <Difficulty level={match.merchant.cancelDifficulty} /> : null}
      <p className="serif text-xl">{match.amount != null ? usd(match.amount) : "—"}</p>
    </li>
  );
}
