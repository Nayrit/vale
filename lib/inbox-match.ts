import { getMerchant } from "./catalog";
import { matchDescriptor } from "./match";
import type { Merchant } from "./types";

export type MailHeaders = {
  from: string;
  subject: string;
  listUnsubscribe: string;
  listId: string;
  precedence: string;
};

export function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/cursor\s*:[^;]+;?/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGoogleBillingSender(from: string) {
  return /payments-noreply@google\.com|googleone-noreply@google|play-noreply@google|googleplay-noreply/i.test(from);
}

export function isStripeSender(from: string) {
  return /\bstripe\.com\b/i.test(from);
}

export function isBillingProcessor(from: string) {
  return /\b(stripe\.com|invoice\.stripe|paypal\.(com|me)|itunes\.apple\.com|apple\.com|bitpay|paddle\.com|fastspring|chargebee|recurly)\b/i.test(
    from,
  );
}

/** Cursor / Claude / ChatGPT mail this address — an account, not a random digest. */
export function matchAccountMailbox(from: string): Merchant | null {
  const m = matchProductSender(from);
  if (m && (m.id === "cursor" || m.id === "claude" || m.id === "chatgpt")) return m;
  return null;
}

const PRODUCT_SENDERS: [RegExp, string][] = [
  [/\bcursor\.com\b/i, "cursor"],
  [/\banysphere\./i, "cursor"],
  [/\banthropic\.com\b/i, "claude"],
  [/\bclaude\.ai\b/i, "claude"],
  [/\bopenai\.com\b/i, "chatgpt"],
  [/\bchatgpt\.com\b/i, "chatgpt"],
  [/\bspotify\./i, "spotify"],
  [/\bnetflix\.com\b/i, "netflix"],
  [/\bnotion\.(so|com)\b/i, "notion"],
  [/\badobe\.com\b/i, "adobe"],
  [/\bdropbox\./i, "dropbox"],
  [/\bduolingo\./i, "duolingo"],
  [/\bgrammarly\./i, "grammarly"],
  [/\bcanva\./i, "canva"],
  [/\bhulu\./i, "hulu"],
  [/\bdisneyplus\./i, "disney-plus"],
  [/\baudible\./i, "audible"],
  [/\blinkedin\./i, "linkedin"],
];

export function matchProductSender(from: string): Merchant | null {
  for (const [re, id] of PRODUCT_SENDERS) {
    if (re.test(from)) return getMerchant(id);
  }
  return null;
}

const BILLING_EVIDENCE =
  /\b(receipt from|invoice from|your receipt|payment receipt|tax invoice|invoice #|invoice number|amount (paid|charged|due)|total charged|you(?:'ve| have) been charged|you were charged|you paid\s*\$|payment confirmation|payment of|billed (on|for|to)|next billing|auto[- ]?renew|subscription (renewed|receipt|confirmation|invoice)|membership (renewed|receipt|confirmation|payment)|google payment|order receipt|thanks for your purchase|thank you for your purchase|recurring payment|paid\s*\$)\b/i;

const PLAN_CONFIRM =
  /\b(welcome to (your )?(the )?(pro|plus|premium|claude pro|chatgpt plus|cursor (pro|business)|google one)|your (pro|plus|premium|copilot) plan is|you(?:'re| are) now (a )?(pro|premium|plus) member|your subscription (is active|has started|was renewed)|thank you for subscribing|your free (copilot|trial|plan) (access|is ready)|copilot (pro|business) subscription)\b/i;

const NEWSLETTER =
  /\b(newsletter|weekly digest|daily digest|roundup|this week in|view in (your )?browser|open in (your )?browser|manage (email )?preferences|unsubscribe|build highlights|new notifications|job alert|hiring|digest)\b/i;

const POLICY_MAIL =
  /\b(terms of service|privacy policy|legal (update|notice)|updates to .{0,80}(terms|policy|tos)|we(?:'ve| have) updated (our )?(terms|policy))\b/i;

const PRODUCT_CHANGE_MAIL =
  /\b(changes|updates) to your .{0,80}(subscription|membership|plan|terms|policy)\b/i;

export function isPolicyMail(subject: string, blob: string) {
  if (POLICY_MAIL.test(subject) || PRODUCT_CHANGE_MAIL.test(subject)) return true;
  if (POLICY_MAIL.test(blob.slice(0, 400))) return true;
  return false;
}

const PASSWORD =
  /\b(password|passcode|sign[- ]?in code|verification code|security alert|new device|unusual activity|reset your|two[- ]step|2fa|otp|login code|new sign[- ]?in|sign[- ]?in to your|signed in to)\b/i;

const MARKETING =
  /\b(introducing|year in (code|review)|meet [a-z0-9]|what'?s new|product update|changelog|new sign[- ]?in)\b/i;

const RECURRING =
  /\b(subscription|membership|recurring|auto[- ]?renew|renewal|next billing|billed (monthly|annually|yearly)|pro plan|plus plan|your plan)\b/i;

const SHIPPING = /\b(shipped|out for delivery|tracking number|on the way|has been delivered)\b/i;

const SUBJECT_RECEIPT =
  /\b(your receipt|receipt from|invoice from|payment receipt|google payment|you(?:'ve| have) been charged)\b/i;

export function hasBillingEvidence(from: string, subject: string, blob: string) {
  return BILLING_EVIDENCE.test(`${from}\n${subject}\n${blob}`);
}

export function hasPlanConfirm(subject: string, blob: string) {
  return PLAN_CONFIRM.test(`${subject}\n${blob.slice(0, 2000)}`);
}

export function isSignInOrMarketing(subject: string) {
  return PASSWORD.test(subject) || MARKETING.test(subject);
}

export function isNewsletter(headers: MailHeaders, blob: string) {
  if (isStripeSender(headers.from) && SUBJECT_RECEIPT.test(headers.subject)) return false;
  if (hasBillingEvidence(headers.from, headers.subject, blob) && RECURRING.test(`${headers.subject}\n${blob.slice(0, 800)}`)) {
    return false;
  }
  if (NEWSLETTER.test(headers.subject)) return true;
  if (NEWSLETTER.test(blob.slice(0, 500))) return true;
  return !!headers.listUnsubscribe || !!headers.listId || /bulk|list/i.test(headers.precedence);
}

export function isMembershipMail(headers: MailHeaders, blob: string) {
  if (isSignInOrMarketing(headers.subject)) return false;
  if (
    isPolicyMail(headers.subject, blob) &&
    !isStripeSender(headers.from) &&
    !SUBJECT_RECEIPT.test(headers.subject)
  ) {
    return false;
  }
  if (SHIPPING.test(headers.subject) && !hasBillingEvidence(headers.from, headers.subject, blob)) {
    return false;
  }
  if (isNewsletter(headers, blob)) return false;

  const catalog =
    matchDescriptor(headers.subject).merchant ||
    matchDescriptor(headers.from).merchant ||
    matchProductSender(headers.from);
  const billing = hasBillingEvidence(headers.from, headers.subject, blob) || SUBJECT_RECEIPT.test(headers.subject);
  const recurring = RECURRING.test(`${headers.subject}\n${blob.slice(0, 2500)}`);
  const stripe = isStripeSender(headers.from);
  const googlePay = isGoogleBillingSender(headers.from);
  const processor = isBillingProcessor(headers.from);

  if (googlePay && billing) return true;
  if (stripe && catalog && billing) return true;
  if (processor && catalog && billing && recurring) return true;
  if (catalog && billing && recurring) return true;
  return false;
}

export function matchGoogleProduct(from: string, subject: string, body: string): Merchant | null {
  if (isPolicyMail(subject, body)) return null;
  if (!isGoogleBillingSender(from) && !/@google\.com\b/i.test(from)) return null;
  if (!isGoogleBillingSender(from) && !/google payment|payment receipt/i.test(subject)) {
    return null;
  }

  const head = `${from} ${subject}`.toLowerCase();
  const text = `${head}\n${body}`.toLowerCase();
  const charged = hasBillingEvidence(from, subject, body);

  if (
    charged &&
    (/google one ai premium|gemini advanced|google ai pro|google ai plus|google ai premium/.test(text) ||
      /\bgemini\b/.test(head))
  ) {
    return getMerchant("gemini");
  }
  if (charged && /youtube premium|youtube music premium/.test(text)) {
    return getMerchant("youtube-premium");
  }
  if (
    charged &&
    (/google one/.test(head) ||
      /googleone/.test(head) ||
      /google one.{0,80}(membership|member|plan|storage|premium|subscriber|\d+\s*(gb|tb))/.test(text) ||
      /(membership|member|plan|storage|\d+\s*(gb|tb)).{0,80}google one/.test(text))
  ) {
    return getMerchant("google-one");
  }
  if (
    charged &&
    /google play/.test(head) &&
    /\b(you(?:'ve| have) been charged|payment receipt|subscription (renewed|receipt)|recurring)\b/.test(text)
  ) {
    return getMerchant("google-play");
  }
  return null;
}

export function matchInboxMerchant(from: string, subject: string, body: string) {
  const google = matchGoogleProduct(from, subject, body);
  if (google) return { merchant: google, confidence: 0.96 };

  if (/@github\.(com|io)\b|\bgithub\.(com|io)\b/i.test(from)) {
    if (/\bcopilot\b/i.test(`${subject}\n${body.slice(0, 1200)}`)) {
      return { merchant: getMerchant("github-copilot"), confidence: 0.93 };
    }
    return { merchant: null, confidence: 0 };
  }

  const sender = matchProductSender(from);
  if (sender) return { merchant: sender, confidence: 0.93 };

  const subj = matchDescriptor(subject);
  if (subj.merchant && subj.confidence >= 0.62) return subj;

  const fromMatch = matchDescriptor(from);
  if (fromMatch.merchant && fromMatch.confidence >= 0.62) return fromMatch;

  if (isStripeSender(from)) {
    const near = matchDescriptor(`${from} ${subject} ${body.slice(0, 600)}`);
    if (near.merchant && near.confidence >= 0.62) return near;
  }

  return { merchant: null, confidence: 0 };
}

function toNumber(raw: string) {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const YEAR_LIKE = new Set([2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]);

export function parseChargeAmount(text: string): number | null {
  const labeled = [
    ...text.matchAll(
      /(?:total|amount paid|amount charged|amount due|charged|you paid|you were charged|payment of|usd|us\$|bdt|tk\.?|inr|eur|gbp|৳)\s*:?\s*\$?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{2})?)/gi,
    ),
  ];
  for (let i = labeled.length - 1; i >= 0; i--) {
    const n = toNumber(labeled[i][1]);
    if (n != null && n >= 0.5 && n < 5000 && !YEAR_LIKE.has(n)) return n;
  }
  return null;
}

export function isLocalCurrency(text: string) {
  return /\b(bdt|tk\.?|taka|inr|rs\.?|৳)\b/i.test(text);
}

export function amountFitsCatalog(amount: number, typical: number) {
  if (typical <= 0) return true;
  return amount <= typical * 6 && amount >= typical * 0.15;
}

const SUBJECT_WATCH: [RegExp, string][] = [
  [/\bgoogle one\b|\bgoogleone\b/i, "google-one"],
  [/\bgemini advanced\b|\bgoogle ai pro\b|\bgoogle ai plus\b|\bgoogle gemini\b/i, "gemini"],
  [/\bchatgpt\b|\bopenai\b/i, "chatgpt"],
  [/\bclaude\b|\banthropic\b/i, "claude"],
  [/\bcursor pro\b|\bcursor\.com\b|\banysphere\b/i, "cursor"],
  [/\byoutube premium\b|\byoutube music premium\b/i, "youtube-premium"],
  [/\bspotify\b/i, "spotify"],
  [/\bnetflix\b/i, "netflix"],
  [/\bamazon prime\b|\bprime membership\b/i, "amazon-prime"],
  [/\badobe\b/i, "adobe"],
  [/\bicloud\b/i, "icloud"],
  [/\bmicrosoft 365\b|\boffice 365\b/i, "microsoft-365"],
  [/\bgithub copilot\b|\bcopilot pro\b/i, "github-copilot"],
  [/\bnotion\b/i, "notion"],
  [/\bapple\.com\/bill\b|\bicloud\+|\bapple one\b/i, "apple-subscriptions"],
];

/** Brand named in From/Subject — not the HTML body, so CSS "cursor" and digests do not count as a bill. */
export function watchlistHits(from: string, subject: string): Merchant[] {
  const found = new Map<string, Merchant>();
  const sender = matchProductSender(from);
  if (sender) found.set(sender.id, sender);
  if (/@github\.(com|io)\b/i.test(from) && /\bcopilot\b/i.test(`${from} ${subject}`)) {
    const m = getMerchant("github-copilot");
    if (m) found.set(m.id, m);
  }
  const google = matchGoogleProduct(from, subject, "");
  if (google) found.set(google.id, google);
  const hay = `${from} ${subject}`;
  for (const [re, id] of SUBJECT_WATCH) {
    if (!re.test(hay)) continue;
    const m = getMerchant(id);
    if (m) found.set(m.id, m);
  }
  return [...found.values()];
}

export function parseLocalAmount(text: string): { amount: number; label: string } | null {
  const m = text.match(
    /(?:bdt|tk\.?|taka|inr|rs\.?|৳)\s*:?\s*(\d{1,6}(?:,\d{2,3})*(?:\.\d{2})?)/i,
  );
  if (!m) return null;
  const n = toNumber(m[1]);
  if (n == null || n < 0.5) return null;
  const label = /৳/.test(m[0]) ? `৳${n}` : /inr|rs/i.test(m[0]) ? `₹${n}` : `Tk ${n}`;
  return { amount: n, label };
}
