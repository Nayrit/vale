import { getMerchant } from "./catalog";
import { matchDescriptor, parseAmount } from "./match";
import type { Merchant } from "./types";

export function isGoogleBillingSender(from: string) {
  return /payments-noreply@google\.com|googleone-noreply@google\.com|googleone@google\.com|gemini-noreply@google\.com/i.test(
    from,
  );
}

export function matchGoogleProduct(from: string, subject: string, body: string): Merchant | null {
  const head = `${from} ${subject}`.toLowerCase();
  const text = `${head}\n${body.slice(0, 2500).toLowerCase()}`;
  const googleBill = isGoogleBillingSender(from);

  if (
    /google one ai premium|gemini advanced|google ai pro|google ai plus/.test(text) ||
    /\bgemini\b/.test(head)
  ) {
    return getMerchant("gemini");
  }
  if (/youtube premium|youtube music premium/.test(text) || /youtube premium/.test(head)) {
    return getMerchant("youtube-premium");
  }
  if (
    /google one/.test(head) ||
    (googleBill && /google one/.test(text)) ||
    /google one (membership|member|plan|storage|\d+\s*(gb|tb))/.test(text)
  ) {
    return getMerchant("google-one");
  }
  if (/google play/.test(text) && /\b(subscription|membership|recurring|renew)\b/.test(text)) {
    return getMerchant("google-play");
  }
  return null;
}

export function matchInboxMerchant(from: string, subject: string, body: string) {
  const google = matchGoogleProduct(from, subject, body);
  if (google) return { merchant: google, confidence: 0.96 };
  const header = matchDescriptor(`${from} ${subject}`);
  if (header.merchant && header.confidence >= 0.62) return header;
  return matchDescriptor(`${from} ${subject} ${body.slice(0, 1200)}`);
}

export function parseChargeAmount(text: string): number | null {
  const labeled = [
    ...text.matchAll(
      /(?:total|charged|amount|usd|us\$|payment of|you paid|you were charged)\s*:?\s*\$?\s*(\d{1,4}(?:,\d{3})*\.\d{2})/gi,
    ),
  ];
  if (labeled.length) {
    const n = Number(labeled[labeled.length - 1][1].replace(/,/g, ""));
    if (Number.isFinite(n) && n < 500) return n;
  }
  const fallback = parseAmount(text);
  if (fallback == null) return null;
  if (fallback >= 500) return null;
  return fallback;
}
