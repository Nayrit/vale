"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SAMPLE_STATEMENT, parseStatement } from "@/lib/match";
import { usd } from "@/lib/money";
import { useStore } from "@/lib/store";
import { Button, Difficulty, MerchantMark, inputClass, toast } from "@/components/ui";

export default function ImportPage() {
  const router = useRouter();
  const { state, importMatches } = useStore();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const matches = useMemo(() => parseStatement(text), [text]);
  const known = matches.filter((m) => m.merchant && m.amount != null);

  function toggle(i: number) {
    setSelected((s) => ({ ...s, [i]: !(s[i] ?? true) }));
  }

  function add() {
    const chosen = matches.filter((m, i) => m.merchant && m.amount != null && (selected[i] ?? true));
    const n = importMatches(chosen);
    toast(n ? `Added ${n} subscription${n === 1 ? "" : "s"}.` : "Those were already on the ledger.");
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Bank → door</p>
      <h1 className="serif mt-3 text-5xl leading-tight sm:text-6xl">
        Paste the ugly names.
        <span className="mt-2 block italic text-moss">Vale finds the portal.</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
        Statements say NETFLIX.COM and APPLE.COM/BILL. They never say “cancel here.” Paste lines from a CSV or a copied statement.
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
        <Button onClick={add} disabled={known.length === 0}>
          Add the matched charges
        </Button>
      </div>

      {text.trim() ? (
        <ul className="mt-10 grid gap-3">
          {matches.map((match, i) => {
            const already = match.merchant
              ? state.subscriptions.some(
                  (s) => s.status !== "cancelled" && s.merchantId === match.merchant!.id,
                )
              : false;
            const on = selected[i] ?? true;
            return (
              <li
                key={`${match.raw}-${i}`}
                className={`flex flex-wrap items-center gap-4 rounded-[1.6rem] bg-cream/80 p-4 ring-1 ring-ink/8 ${
                  match.merchant ? "" : "opacity-70"
                }`}
              >
                {match.merchant ? (
                  <button
                    type="button"
                    onClick={() => toggle(i)}
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
                    {match.merchant ? match.merchant.name : "Unknown merchant"}
                    {already ? <span className="ml-2 text-xs text-muted">already on ledger</span> : null}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted">{match.descriptor || match.raw}</p>
                </div>
                {match.merchant ? <Difficulty level={match.merchant.cancelDifficulty} /> : null}
                <p className="serif text-xl">{match.amount != null ? usd(match.amount) : "—"}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-12 max-w-lg text-sm leading-relaxed text-muted">
          Tip: APPLE.COM/BILL is not a service. It is a hallway. Vale opens Apple’s subscription list so you can see which apps are hiding inside one charge.
        </p>
      )}
    </div>
  );
}
