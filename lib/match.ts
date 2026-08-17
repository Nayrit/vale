import { merchants } from "./catalog";
import type { Merchant, StatementMatch } from "./types";

function normalize(s: string) {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAmount(line: string): number | null {
  const matches = [...line.matchAll(/-?\$?\d{1,4}(?:,\d{3})*(?:\.\d{2})/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1][0].replace(/[$,]/g, "");
  const n = Number(last);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function parseDate(line: string): string | null {
  const m = line.match(/\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/);
  return m ? m[1] : null;
}

function score(descriptor: string, merchant: Merchant) {
  const d = normalize(descriptor);
  if (!d) return 0;
  let best = 0;
  for (const alias of merchant.aliases) {
    const a = normalize(alias);
    if (!a) continue;
    if (d === a) best = Math.max(best, 1);
    else if (d.includes(a)) best = Math.max(best, 0.55 + a.length / Math.max(d.length, 1) / 2);
    else if (a.includes(d) && d.length >= 5) best = Math.max(best, 0.62);
  }
  return best;
}

export function matchDescriptor(descriptor: string) {
  let best: { merchant: Merchant; confidence: number } | null = null;
  for (const merchant of merchants) {
    const confidence = score(descriptor, merchant);
    if (!best || confidence > best.confidence) best = { merchant, confidence };
  }
  if (!best) return { merchant: null, confidence: 0 };
  if (best.confidence < 0.55) return { merchant: null, confidence: best.confidence };
  return best;
}

export function parseStatement(text: string): StatementMatch[] {
  const rows = text
    .split(/\n+/)
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 2 && !raw.startsWith("#"))
    .filter((raw) => !/^(date|posted|description|amount|merchant|details|transaction)\b/i.test(raw))
    .map((raw) => {
      const amount = parseAmount(raw);
      const date = parseDate(raw);
      let descriptor = raw.replace(/,/g, " ");
      if (date) descriptor = descriptor.replace(date, " ");
      if (amount != null) {
        descriptor = descriptor.replace(new RegExp(`\\$?${amount.toFixed(2).replace(".", "\\.")}`), " ");
        descriptor = descriptor.replace(new RegExp(`\\$?${amount}`), " ");
      }
      descriptor = descriptor.replace(/[|$]/g, " ").replace(/\s+/g, " ").trim();
      const { merchant, confidence } = matchDescriptor(descriptor);
      return { raw, descriptor, amount, date, merchant, confidence, kind: "purchase" as const };
    });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.merchant?.id || normalize(row.descriptor).slice(0, 28);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rows.map((row) => {
    const key = row.merchant?.id || normalize(row.descriptor).slice(0, 28);
    const repeats = (counts.get(key) ?? 0) >= 2;
    const kind: StatementMatch["kind"] =
      row.merchant && row.amount != null ? "subscription" : repeats && row.amount != null ? "subscription" : "purchase";
    return { ...row, kind };
  });
}

export const SAMPLE_STATEMENT = `08/01 NETFLIX.COM 17.99
08/03 SPOTIFY USA 11.99
08/04 PLANET FITNESS 24.99
08/05 ADOBE *PHOTOSHOP 54.99
08/06 APPLE.COM/BILL 9.99
08/07 HULU 17.99
08/08 DISNEYPLUS 13.99
08/09 LINKEDIN PREM 29.99
08/10 OPENAI *CHATGPT 20.00
08/11 AUDIBLE 14.95
08/12 NYTIMES DIGITAL 17.00
08/13 CLASSPASS 49.00
08/14 AMAZON PRIME 14.99
08/15 CALM.COM 69.99
08/16 GOOGLE ONE 2.99
08/17 GOOGLE AI PRO 19.99
08/18 AMAZON MKTPLACE 47.23
08/19 VW GULSHAN 12.50`;
