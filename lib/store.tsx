"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getMerchant } from "./catalog";
import { daysFromNowIso, daysSince } from "./dates";
import { monthlyOf } from "./money";
import type {
  AppState,
  BillingCycle,
  Plan,
  Profile,
  StatementMatch,
  Subscription,
} from "./types";

const KEY_PREFIX = "vale-ledger-v3:";

const empty: AppState = {
  profile: null,
  plan: "free",
  unusedDays: 60,
  subscriptions: [],
  savings: [],
  inboxPrompt: "pending",
  inboxScannedAt: null,
};

type Store = {
  ready: boolean;
  state: AppState;
  switchUser: (userId: string, profile: Profile) => void;
  unloadUser: () => void;
  addSubscription: (input: {
    merchantId?: string | null;
    name: string;
    amount: number;
    cycle: BillingCycle;
    lastUsedAt?: string | null;
    bankDescriptor?: string;
    notes?: string;
  }) => string;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;
  markUsed: (id: string) => void;
  confirmCancel: (id: string) => void;
  restore: (id: string) => void;
  importMatches: (matches: StatementMatch[]) => number;
  importInbox: (
    findings: {
      merchantId: string;
      name: string;
      amount: number;
      cycle: BillingCycle;
      bankDescriptor?: string;
    }[],
  ) => number;
  setInboxPrompt: (value: AppState["inboxPrompt"]) => void;
  setInboxScannedAt: (iso: string | null) => void;
  setPlan: (plan: Plan) => void;
  setUnusedDays: (n: number) => void;
  reset: () => void;
};

const Ctx = createContext<Store | null>(null);

function uid() {
  return crypto.randomUUID();
}

const listeners = new Set<() => void>();
let memory: AppState = empty;
let activeUserId: string | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function write(next: AppState) {
  memory = next;
  if (typeof window !== "undefined" && activeUserId) {
    localStorage.setItem(KEY_PREFIX + activeUserId, JSON.stringify(next));
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return memory;
}

function getServerSnapshot() {
  return empty;
}

function applyImport(s: AppState, matches: StatementMatch[]) {
  const incoming = matches.filter((m) => m.merchant && m.amount != null);
  const have = new Set(
    s.subscriptions.filter((sub) => sub.status !== "cancelled" && sub.merchantId).map((sub) => sub.merchantId),
  );
  const next = [...s.subscriptions];
  let added = 0;
  for (const match of incoming) {
    const merchant = match.merchant!;
    if (have.has(merchant.id)) continue;
    have.add(merchant.id);
    added += 1;
    next.unshift({
      id: uid(),
      merchantId: merchant.id,
      name: merchant.name,
      amount: match.amount!,
      cycle: merchant.cycle,
      lastUsedAt: null,
      startedAt: new Date().toISOString(),
      nextChargeAt: daysFromNowIso(merchant.cycle === "yearly" ? 365 : 30),
      status: "active",
      bankDescriptor: match.descriptor,
      source: "statement" as const,
    });
  }
  return { state: { ...s, subscriptions: next }, added };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const patch = useCallback((fn: (s: AppState) => AppState) => {
    write(fn(memory));
  }, []);

  const switchUser = useCallback((userId: string, profile: Profile) => {
    activeUserId = userId;
    try {
      const raw = localStorage.getItem(KEY_PREFIX + userId);
      memory = raw ? { ...empty, ...JSON.parse(raw), profile } : { ...empty, profile };
    } catch {
      memory = { ...empty, profile };
    }
    write(memory);
  }, []);

  const unloadUser = useCallback(() => {
    activeUserId = null;
    memory = empty;
    emit();
  }, []);

  const addSubscription: Store["addSubscription"] = useCallback((input) => {
    const id = uid();
    const merchant = getMerchant(input.merchantId);
    const sub: Subscription = {
      id,
      merchantId: input.merchantId ?? merchant?.id ?? null,
      name: input.name,
      amount: input.amount,
      cycle: input.cycle,
      lastUsedAt: input.lastUsedAt ?? null,
      startedAt: new Date().toISOString(),
      nextChargeAt: daysFromNowIso(input.cycle === "yearly" ? 365 : input.cycle === "weekly" ? 7 : 30),
      status: "active",
      bankDescriptor: input.bankDescriptor,
      notes: input.notes,
      source: "manual",
    };
    patch((s) => ({ ...s, subscriptions: [sub, ...s.subscriptions] }));
    return id;
  }, [patch]);

  const updateSubscription: Store["updateSubscription"] = useCallback(
    (id, next) => {
      patch((s) => ({
        ...s,
        subscriptions: s.subscriptions.map((sub) => (sub.id === id ? { ...sub, ...next } : sub)),
      }));
    },
    [patch],
  );

  const removeSubscription: Store["removeSubscription"] = useCallback(
    (id) => {
      patch((s) => ({
        ...s,
        subscriptions: s.subscriptions.filter((sub) => sub.id !== id),
      }));
    },
    [patch],
  );

  const markUsed: Store["markUsed"] = useCallback(
    (id) => {
      updateSubscription(id, { lastUsedAt: new Date().toISOString() });
    },
    [updateSubscription],
  );

  const confirmCancel: Store["confirmCancel"] = useCallback(
    (id) => {
      patch((s) => {
        const sub = s.subscriptions.find((x) => x.id === id);
        if (!sub) return s;
        const cancelledAt = new Date().toISOString();
        return {
          ...s,
          subscriptions: s.subscriptions.map((x) =>
            x.id === id ? { ...x, status: "cancelled" as const, cancelledAt } : x,
          ),
          savings: s.savings.some((e) => e.subscriptionId === id)
            ? s.savings
            : [
                {
                  id: uid(),
                  subscriptionId: id,
                  name: sub.name,
                  monthlyAmount: monthlyOf(sub.amount, sub.cycle),
                  cancelledAt,
                },
                ...s.savings,
              ],
        };
      });
    },
    [patch],
  );

  const restore: Store["restore"] = useCallback(
    (id) => {
      patch((s) => ({
        ...s,
        subscriptions: s.subscriptions.map((sub) =>
          sub.id === id ? { ...sub, status: "active" as const, cancelledAt: undefined } : sub,
        ),
        savings: s.savings.filter((e) => e.subscriptionId !== id),
      }));
    },
    [patch],
  );

  const importMatches: Store["importMatches"] = useCallback((matches) => {
    const next = applyImport(memory, matches);
    write(next.state);
    return next.added;
  }, []);

  const importInbox: Store["importInbox"] = useCallback((findings) => {
    let added = 0;
    patch((s) => {
      const have = new Set(
        s.subscriptions.filter((sub) => sub.status !== "cancelled" && sub.merchantId).map((sub) => sub.merchantId),
      );
      const next = [...s.subscriptions];
      for (const finding of findings) {
        if (have.has(finding.merchantId)) continue;
        have.add(finding.merchantId);
        added += 1;
        next.unshift({
          id: uid(),
          merchantId: finding.merchantId,
          name: finding.name,
          amount: finding.amount,
          cycle: finding.cycle,
          lastUsedAt: null,
          startedAt: new Date().toISOString(),
          nextChargeAt: daysFromNowIso(finding.cycle === "yearly" ? 365 : finding.cycle === "weekly" ? 7 : 30),
          status: "active",
          bankDescriptor: finding.bankDescriptor,
          source: "inbox",
        });
      }
      return { ...s, subscriptions: next, inboxPrompt: "allowed", inboxScannedAt: new Date().toISOString() };
    });
    return added;
  }, [patch]);

  const setInboxPrompt: Store["setInboxPrompt"] = useCallback(
    (value) => patch((s) => ({ ...s, inboxPrompt: value })),
    [patch],
  );

  const setInboxScannedAt: Store["setInboxScannedAt"] = useCallback(
    (iso) => patch((s) => ({ ...s, inboxScannedAt: iso })),
    [patch],
  );

  const setPlan: Store["setPlan"] = useCallback(
    (plan) => patch((s) => ({ ...s, plan })),
    [patch],
  );

  const setUnusedDays: Store["setUnusedDays"] = useCallback(
    (n) => patch((s) => ({ ...s, unusedDays: n })),
    [patch],
  );

  const reset = useCallback(() => {
    if (activeUserId) localStorage.removeItem(KEY_PREFIX + activeUserId);
    write({ ...empty, profile: memory.profile });
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready,
      state: ready ? state : empty,
      switchUser,
      unloadUser,
      addSubscription,
      updateSubscription,
      removeSubscription,
      markUsed,
      confirmCancel,
      restore,
      importMatches,
      importInbox,
      setInboxPrompt,
      setInboxScannedAt,
      setPlan,
      setUnusedDays,
      reset,
    }),
    [
      ready,
      state,
      switchUser,
      unloadUser,
      addSubscription,
      updateSubscription,
      removeSubscription,
      markUsed,
      confirmCancel,
      restore,
      importMatches,
      importInbox,
      setInboxPrompt,
      setInboxScannedAt,
      setPlan,
      setUnusedDays,
      reset,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function isQuiet(sub: Subscription, unusedDays: number) {
  if (sub.status === "cancelled") return false;
  const days = daysSince(sub.lastUsedAt);
  if (days == null) return true;
  return days >= unusedDays;
}
