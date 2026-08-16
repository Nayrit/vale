"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { getMerchant, searchMerchants } from "@/lib/catalog";
import { daysAgoIso } from "@/lib/dates";
import type { BillingCycle } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button, CycleSelect, Field, Mark, inputClass, toast } from "@/components/ui";

function AddForm() {
  const router = useRouter();
  const params = useSearchParams();
  const preset = getMerchant(params.get("merchant"));
  const { addSubscription } = useStore();
  const [query, setQuery] = useState(preset?.name ?? "");
  const [merchantId, setMerchantId] = useState(preset?.id ?? "");
  const [name, setName] = useState(preset?.name ?? "");
  const [amount, setAmount] = useState(String(preset?.typicalPrice ?? ""));
  const [cycle, setCycle] = useState<BillingCycle>(preset?.cycle ?? "monthly");
  const [lastUsed, setLastUsed] = useState<"today" | "week" | "month" | "long" | "never">("never");

  const suggestions = useMemo(() => (query ? searchMerchants(query).slice(0, 6) : []), [query]);
  const merchant = getMerchant(merchantId);

  function pick(id: string) {
    const m = getMerchant(id);
    if (!m) return;
    setMerchantId(m.id);
    setName(m.name);
    setQuery(m.name);
    setAmount(String(m.typicalPrice));
    setCycle(m.cycle);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!name.trim() || !Number.isFinite(n) || n <= 0) return;
    const lastUsedAt =
      lastUsed === "today"
        ? daysAgoIso(0)
        : lastUsed === "week"
          ? daysAgoIso(4)
          : lastUsed === "month"
            ? daysAgoIso(21)
            : lastUsed === "long"
              ? daysAgoIso(90)
              : null;
    const id = addSubscription({
      merchantId: merchantId || null,
      name: name.trim(),
      amount: n,
      cycle,
      lastUsedAt,
      bankDescriptor: merchant?.aliases[0],
    });
    toast(`${name} is on the ledger.`);
    router.push(`/subscriptions/${id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted">By hand</p>
      <h1 className="serif mt-3 text-5xl">Add a charge</h1>
      <p className="mt-4 text-muted">Search the catalog first. Custom names work too.</p>

      <form onSubmit={onSubmit} className="mt-10 grid gap-5">
        <Field label="Service">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setName(e.target.value);
              setMerchantId("");
            }}
            placeholder="Disney+, gym, Adobe…"
          />
        </Field>
        {suggestions.length > 0 && !merchantId ? (
          <ul className="grid gap-2">
            {suggestions.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-cream px-3 py-2 text-left ring-1 ring-ink/8"
                >
                  <Mark name={m.name} color={m.color} letter={m.letter} size="sm" />
                  <span>{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {merchant ? (
          <div className="flex items-center gap-3 rounded-2xl bg-moss/8 px-4 py-3 text-sm">
            <Mark name={merchant.name} color={merchant.color} letter={merchant.letter} size="sm" />
            <span>
              Matched to {merchant.name}. Cancel difficulty: {merchant.cancelDifficulty}.
            </span>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Amount">
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="14.99"
            />
          </Field>
          <Field label="Cycle">
            <CycleSelect value={cycle} onChange={setCycle} />
          </Field>
        </div>

        <Field label="Last time you actually used it">
          <select
            className={inputClass}
            value={lastUsed}
            onChange={(e) => setLastUsed(e.target.value as typeof lastUsed)}
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="long">Months ago</option>
            <option value="never">I am not sure</option>
          </select>
        </Field>

        <Button type="submit" className="mt-2">
          Save to ledger
        </Button>
      </form>
    </div>
  );
}

export default function AddPage() {
  return (
    <Suspense fallback={<p className="serif text-2xl italic text-muted">Vale</p>}>
      <AddForm />
    </Suspense>
  );
}
