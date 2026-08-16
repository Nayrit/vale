import type { BillingCycle, Subscription } from "./types";

export function usd(n: number, compact = false) {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: compact && abs >= 100 && Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
  return formatted;
}

export function monthlyOf(amount: number, cycle: BillingCycle) {
  if (cycle === "weekly") return amount * 4.345;
  if (cycle === "yearly") return amount / 12;
  return amount;
}

export function yearlyOf(amount: number, cycle: BillingCycle) {
  return monthlyOf(amount, cycle) * 12;
}

export function monthlyOfSub(sub: Subscription) {
  return monthlyOf(sub.amount, sub.cycle);
}

export function cycleLabel(cycle: BillingCycle) {
  if (cycle === "weekly") return "week";
  if (cycle === "yearly") return "year";
  return "month";
}

export function shareCut(yearlySavings: number) {
  return yearlySavings * 0.15;
}
