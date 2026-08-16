import { getMerchant } from "./catalog";
import { matchDescriptor } from "./match";
import type { Merchant } from "./types";

export function isGoogleBillingSender(from: string) {
  return /@(google|googlemail)\.com\b/i.test(from) &&
    /payment|googleone|google-one|gemini|noreply|no-reply|billing|receipt|accounts/i.test(from);
}

export function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchGoogleProduct(from: string, subject: string, body: string): Merchant | null {
  const head = `${from} ${subject}`.toLowerCase();
  const text = `${head}\n${body}`.toLowerCase();

  if (
    /google one ai premium|gemini advanced|google ai pro|google ai plus|google ai premium/.test(text) ||
    /\bgemini\b/.test(head) ||
    /google gemini/.test(head)
  ) {
    return getMerchant("gemini");
  }
  if (/youtube premium|youtube music premium/.test(text)) {
    return getMerchant("youtube-premium");
  }
  if (
    /google one/.test(head) ||
    /googleone/.test(head) ||
    /google one.{0,80}(membership|member|plan|storage|premium|subscriber|\d+\s*(gb|tb))/.test(text) ||
    /(membership|member|plan|storage|\d+\s*(gb|tb)).{0,80}google one/.test(text)
  ) {
    return getMerchant("google-one");
  }
  if (/google play/.test(text) && /\b(subscription|membership|recurring|renew)\b/.test(text)) {
    return getMerchant("google-play");
  }
  return null;
}

const SENDER_MERCHANTS: [RegExp, string][] = [
  [/@cursor\.com\b/i, "cursor"],
  [/@anysphere\./i, "cursor"],
  [/@anthropic\.com\b/i, "claude"],
  [/@claude\.ai\b/i, "claude"],
  [/@openai\.com\b/i, "chatgpt"],
  [/@chatgpt\.com\b/i, "chatgpt"],
  [/@spotify\./i, "spotify"],
  [/@netflix\.com\b/i, "netflix"],
  [/@notion\.(so|com)\b/i, "notion"],
  [/@adobe\.com\b/i, "adobe"],
  [/@dropbox\./i, "dropbox"],
  [/@github\.(com|io)\b/i, "github-copilot"],
  [/@linkedin\./i, "linkedin"],
  [/@duolingo\./i, "duolingo"],
  [/@grammarly\./i, "grammarly"],
  [/@canva\./i, "canva"],
  [/@discord\./i, "discord-nitro"],
  [/@audible\./i, "audible"],
  [/@hulu\./i, "hulu"],
  [/@disney(plus)?\./i, "disney-plus"],
  [/@primevideo\.|amazonprime|kindle\.amazon/i, "amazon-prime"],
  [/@icloud\.com\b/i, "icloud"],
  [/@microsoft\.(com|online)\b/i, "microsoft-365"],
];

export function matchSenderMerchant(from: string): Merchant | null {
  for (const [re, id] of SENDER_MERCHANTS) {
    if (re.test(from)) return getMerchant(id);
  }
  return null;
}

export function isBillingProcessor(from: string) {
  return /\b(stripe\.com|invoice\.stripe|paypal\.|apple\.com|payments-noreply@google|googleone-noreply|paddle\.com|fastspring|chargebee|recurly|squareup|pay\.google)\b/i.test(
    from,
  );
}

export function matchInboxMerchant(from: string, subject: string, body: string) {
  const google = matchGoogleProduct(from, subject, body);
  if (google) return { merchant: google, confidence: 0.96 };
  const sender = matchSenderMerchant(from);
  if (sender) return { merchant: sender, confidence: 0.93 };
  const header = matchDescriptor(`${from} ${subject}`);
  if (header.merchant && header.confidence >= 0.55) return header;
  const subj = matchDescriptor(subject);
  if (subj.merchant && subj.confidence >= 0.55) return subj;
  const near = matchDescriptor(`${from} ${subject} ${body.slice(0, 1500)}`);
  if (near.merchant && near.confidence >= 0.55) return near;
  return { merchant: null, confidence: Math.max(header.confidence, subj.confidence, near.confidence) };
}

function toNumber(raw: string) {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseChargeAmount(text: string): number | null {
  const labeled = [
    ...text.matchAll(
      /(?:total|charged|amount|usd|us\$|bdt|tk\.?|inr|eur|gbp|payment of|you paid|you were charged|৳)\s*:?\s*\$?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{2})?)/gi,
    ),
  ];
  for (let i = labeled.length - 1; i >= 0; i--) {
    const n = toNumber(labeled[i][1]);
    if (n != null && n >= 0 && n < 100000 && n !== 2024 && n !== 2025 && n !== 2026) return n;
  }
  const money = [
    ...text.matchAll(/[\$€£৳]\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{2})?)/g),
    ...text.matchAll(/\b(\d{1,4}(?:,\d{3})*\.\d{2})\b/g),
  ];
  for (let i = money.length - 1; i >= 0; i--) {
    const n = toNumber(money[i][1]);
    if (n != null && n >= 0.5 && n < 100000 && n < 1900) return n;
  }
  return null;
}

export function isLocalCurrency(text: string) {
  return /\b(bdt|tk\.?|taka|inr|rs\.?|৳)\b/i.test(text);
}
