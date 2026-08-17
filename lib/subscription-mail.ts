/**
 * Problem
 * -------
 * Vale can only read Gmail. There is no Google API for “subscriptions on this account.”
 * Mail mixes three things that all say “receipt” or name a brand:
 *
 *   1. Recurring subscriptions (Stripe “Receipt from Anthropic”, Google One membership).
 *   2. One-time purchases (POS / shop / a single Stripe invoice).
 *   3. Noise (sign-in, marketing, terms of service).
 *
 * A single email is not a subscription. A subscription is either explicit recurring
 * language, a known subscription product with a payment (not a one-off), or the same
 * merchant charged more than once across time.
 *
 * Decision
 * --------
 * Collect payment events → drop noise and one-time buys → group by merchant →
 * keep only groups that pass recurring proof. Never invent a catalog “typical” price.
 */

import type { BillingCycle, Merchant } from "./types";
import { amountFitsCatalog, isBillingProcessor, isStripeSender } from "./inbox-match";

export type ChargeEvent = {
  merchant: Merchant | null;
  name: string;
  amount: number;
  cycle: BillingCycle;
  from: string;
  subject: string;
  dateMs: number;
  recurring: boolean;
  oneTime: boolean;
};

const NOISE =
  /\b(password|passcode|sign[- ]?in code|verification code|security alert|new device|unusual activity|reset your|two[- ]step|2fa|otp|login code|new sign[- ]?in|sign[- ]?in to your|signed in to|introducing|year in (code|review)|meet [a-z0-9]|what'?s new|product update|changelog|terms of service|privacy policy)\b/i;

const ONE_TIME =
  /\b(one[- ]?time|one off|single purchase|not a subscription|order confirmation|order #|ord(er)?\s*#|pos\b|point of sale|dine[- ]?in|takeaway|take-out|pickup|table\s*\d|shipped|out for delivery|tracking number|thank you for your order|in-store|store purchase)\b/i;

const RECURRING =
  /\b(subscription|subscribed|membership|recurring|auto[- ]?renew|renews on|renewal|next billing|billing period|billed (monthly|annually|yearly|weekly)|\/\s*(mo|month|yr|year)\b|per (month|year|week)|monthly plan|annual plan|pro plan|plus plan)\b/i;

export function isNoiseSubject(subject: string) {
  return NOISE.test(subject);
}

export function isOneTimePurchase(subject: string, blob: string) {
  return ONE_TIME.test(`${subject}\n${blob.slice(0, 4000)}`);
}

export function isRecurringLanguage(subject: string, blob: string) {
  return RECURRING.test(`${subject}\n${blob.slice(0, 4000)}`);
}

function spanDays(events: ChargeEvent[]) {
  const times = events.map((e) => e.dateMs).filter((n) => n > 0).sort((a, b) => a - b);
  if (times.length < 2) return 0;
  return (times[times.length - 1] - times[0]) / 86_400_000;
}

/**
 * Promote a merchant to a subscription only with recurring proof.
 * Unknown shops need two charges ≥ 20 days apart, or explicit recurring language.
 * Catalog products (Cursor, Claude, Netflix…) need a payment that is not a one-time buy.
 */
export function selectSubscriptions(events: ChargeEvent[]): ChargeEvent[] {
  const groups = new Map<string, ChargeEvent[]>();
  for (const event of events) {
    if (event.oneTime) continue;
    const key = event.merchant?.id || `raw:${event.name.trim().toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const kept: ChargeEvent[] = [];
  for (const [, list] of groups) {
    const catalog = list.some((e) => e.merchant);
    const recurring = list.some((e) => e.recurring);
    const repeats = spanDays(list) >= 20 && list.length >= 2;
    const priced = list.some(
      (e) => e.merchant && e.amount > 0 && amountFitsCatalog(e.amount, e.merchant.typicalPrice),
    );
    const processorPaid = list.some(
      (e) => e.merchant && e.amount > 0 && (isStripeSender(e.from) || isBillingProcessor(e.from)),
    );

    if (recurring || repeats) {
      kept.push(bestEvent(list));
      continue;
    }
    if (catalog && (priced || processorPaid)) {
      kept.push(bestEvent(list));
    }
  }
  return kept;
}

function bestEvent(list: ChargeEvent[]) {
  return list.slice().sort((a, b) => {
    if (a.recurring !== b.recurring) return a.recurring ? -1 : 1;
    if (a.amount !== b.amount) return b.amount - a.amount;
    return b.dateMs - a.dateMs;
  })[0];
}
