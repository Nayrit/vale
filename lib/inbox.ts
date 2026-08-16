import { getMerchant } from "./catalog";
import {
  matchInboxMerchant,
  matchGoogleProduct,
  parseChargeAmount,
  htmlToText,
  isLocalCurrency,
  isBillingProcessor,
} from "./inbox-match";
import type { BillingCycle, Merchant } from "./types";

export type InboxFinding = {
  key: string;
  merchant: Merchant | null;
  name: string;
  amount: number;
  estimated: boolean;
  free: boolean;
  cycle: BillingCycle;
  from: string;
  subject: string;
  date: string | null;
  confidence: number;
};

export type ScanProgress = { done: number; total: number; phase: string };

export type InboxScanResult = {
  findings: InboxFinding[];
  missed: Merchant[];
  scanned: number;
  estimate: number;
  mode: "all" | "billing";
};

/** Services Vale always reports as found or not-found after a scan. */
export const INBOX_WATCHLIST_IDS = [
  "google-one",
  "gemini",
  "chatgpt",
  "claude",
  "cursor",
  "youtube-premium",
  "spotify",
  "netflix",
  "apple-subscriptions",
  "amazon-prime",
  "adobe",
  "icloud",
  "microsoft-365",
  "github-copilot",
  "notion",
] as const;

type GmailPart = {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
  snippet?: string;
  internalDate?: string;
};

type GmailList = {
  messages?: { id: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

function header(msg: GmailMessage, name: string) {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function b64url(data: string) {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gmailGet<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if ((res.status === 429 || res.status === 503) && attempt < 4) {
    await sleep(800 * (attempt + 1));
    return gmailGet<T>(token, path, attempt + 1);
  }
  if (res.status === 403) {
    throw new Error(
      "Gmail refused access. Enable the Gmail API and add gmail.readonly on the OAuth consent screen.",
    );
  }
  if (res.status === 401) throw new Error("Google access expired. Allow inbox access again.");
  if (!res.ok) throw new Error(`Gmail returned ${res.status}.`);
  return res.json() as Promise<T>;
}

async function collectText(token: string, messageId: string, part: GmailPart | undefined, into: string[]) {
  if (!part) return;
  const mime = part.mimeType ?? "";
  const isText = mime.startsWith("text/") || mime === "application/xhtml+xml" || !mime;
  if (isText) {
    let raw = "";
    if (part.body?.data) raw = b64url(part.body.data);
    else if (part.body?.attachmentId) {
      const att = await gmailGet<{ data?: string }>(
        token,
        `messages/${messageId}/attachments/${part.body.attachmentId}`,
      );
      if (att.data) raw = b64url(att.data);
    }
    if (raw) into.push(mime.includes("html") ? htmlToText(raw) : raw);
  }
  for (const child of part.parts ?? []) await collectText(token, messageId, child, into);
}

function guessCycle(text: string, fallback: BillingCycle): BillingCycle {
  const t = text.toLowerCase();
  if (/\b(annual|yearly|\/\s*year|per year|billed annually)\b/.test(t)) return "yearly";
  if (/\b(weekly|\/\s*week|per week)\b/.test(t)) return "weekly";
  return fallback;
}

const NOT_A_CHARGE =
  /\b(password|passcode|sign[- ]?in code|verification code|security alert|new device|unusual activity|reset your|two[- ]step|2fa|otp|login code)\b/i;

const SHIPPING = /\b(shipped|out for delivery|tracking number|on the way|has been delivered)\b/i;

const CHARGE_HINT =
  /\b(subscription|subscribed|invoice|renewal|membership|recurring|receipt|billing|you've been charged|you have been charged|payment confirmation|free trial|free plan|google one|gemini|stripe|cursor|claude|anthropic|anysphere|billed|auto[- ]?renew|paid plan|premium|pro plan|plus plan)\b/i;

function looksLikeCharge(from: string, subject: string, blob: string) {
  if (NOT_A_CHARGE.test(subject)) return false;
  if (SHIPPING.test(subject) && !/\b(subscription|membership|renew)\b/i.test(subject + blob.slice(0, 400))) {
    return false;
  }
  if (isBillingProcessor(from)) return true;
  if (matchGoogleProduct(from, subject, blob)) return true;
  return CHARGE_HINT.test(`${from}\n${subject}\n${blob}`);
}

function displayName(from: string, subject: string) {
  const fromName = from.match(/^"?([^"<@]+)"?\s*</);
  if (fromName && !/noreply|no-reply|payments|stripe|receipt|invoice|mailer|support/i.test(fromName[1])) {
    return fromName[1].trim();
  }
  const named = subject.match(/(?:from|for)\s+([A-Z][A-Za-z0-9 .&+-]{2,48})/);
  if (named) return named[1].replace(/\s+inc\.?$/i, "").trim();
  const domain = from.match(/@([a-z0-9-]+)\./i);
  if (domain && !/gmail|googlemail|google|stripe|paypal|appleid|email|mailgun|sendgrid/i.test(domain[1])) {
    return domain[1].replace(/-/g, " ");
  }
  return subject.replace(/^(your|re:|fwd:)\s+/i, "").slice(0, 48) || "Unknown charge";
}

async function listAllIds(
  token: string,
  q: string,
  cap: number,
  onPage?: (count: number) => void,
) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let estimate = 0;
  while (ids.length < cap) {
    const n = Math.min(100, cap - ids.length);
    const path = pageToken
      ? `messages?maxResults=${n}&q=${encodeURIComponent(q)}&pageToken=${encodeURIComponent(pageToken)}`
      : `messages?maxResults=${n}&q=${encodeURIComponent(q)}`;
    const data = await gmailGet<GmailList>(token, path);
    estimate = data.resultSizeEstimate ?? estimate;
    for (const m of data.messages ?? []) ids.push(m.id);
    onPage?.(ids.length);
    if (!data.nextPageToken || !data.messages?.length) {
      return { ids, estimate, complete: true };
    }
    pageToken = data.nextPageToken;
  }
  return { ids, estimate, complete: false };
}

function billingQueries() {
  return [
    "newer_than:36m from:(stripe.com OR paypal.com OR apple.com OR google.com OR openai.com OR anthropic.com OR cursor.com OR anysphere.com OR github.com OR adobe.com OR spotify.com OR netflix.com OR microsoft.com OR dropbox.com OR notion.so OR paddle.com)",
    "newer_than:36m (subject:receipt OR subject:invoice OR subject:subscription OR subject:renewal OR subject:membership OR subject:billing OR subject:payment)",
    'newer_than:36m ("Google One" OR "Gemini Advanced" OR "Google AI Pro" OR "AI Premium" OR "Claude Pro" OR Anysphere OR Cursor OR ChatGPT OR OpenAI)',
    'newer_than:36m (recurring OR "you\'ve been charged" OR "free trial" OR "free plan" OR subscribed OR "auto-renew")',
    "newer_than:36m (label:purchases OR category:purchases)",
    "newer_than:36m from:payments-noreply@google.com",
    "newer_than:36m from:googleone-noreply@google.com",
  ];
}

function keepFinding(prev: InboxFinding | undefined, next: InboxFinding) {
  if (!prev) return next;
  if (prev.free && !next.free) return next;
  if (!prev.free && next.free) return prev;
  if (next.confidence > prev.confidence) return next;
  if (next.confidence === prev.confidence && next.amount > prev.amount) return next;
  return prev;
}

function findingKey(merchant: Merchant | null, name: string) {
  return merchant?.id || `raw:${name.trim().toLowerCase()}`;
}

const ALL_MAIL = "in:anywhere -in:chats";
const FULL_READ_CAP = 800;
const BILLING_CAP = 900;
const FULL_READ_IF_AT_MOST = 500;

export async function scanGmailInbox(
  token: string,
  onProgress?: (p: ScanProgress) => void,
): Promise<InboxScanResult> {
  onProgress?.({ done: 0, total: 1, phase: "Counting mail" });
  const sample = await gmailGet<GmailList>(
    token,
    `messages?maxResults=100&q=${encodeURIComponent(ALL_MAIL)}`,
  );
  const estimate = sample.resultSizeEstimate ?? sample.messages?.length ?? 0;
  const firstComplete = !sample.nextPageToken;
  const readAll = firstComplete || estimate <= FULL_READ_IF_AT_MOST;

  const ids = new Set<string>();
  (sample.messages ?? []).forEach((m) => ids.add(m.id));

  if (readAll) {
    onProgress?.({ done: ids.size, total: Math.min(estimate || ids.size, FULL_READ_CAP), phase: "Listing every message" });
    const rest = await listAllIds(token, ALL_MAIL, FULL_READ_CAP, (count) => {
      onProgress?.({ done: count, total: Math.min(estimate || count, FULL_READ_CAP), phase: "Listing every message" });
    });
    rest.ids.forEach((id) => ids.add(id));
  } else {
    const queries = billingQueries();
    for (let i = 0; i < queries.length; i++) {
      onProgress?.({ done: i, total: queries.length, phase: "Listing receipts" });
      const found = await listAllIds(token, queries[i], 300);
      found.ids.forEach((id) => ids.add(id));
      if (ids.size >= BILLING_CAP) break;
    }
  }

  const list = [...ids].slice(0, readAll ? FULL_READ_CAP : BILLING_CAP);
  const findings = new Map<string, InboxFinding>();
  onProgress?.({ done: 0, total: list.length || 1, phase: "Reading messages" });

  for (let i = 0; i < list.length; i += 8) {
    const chunk = list.slice(i, i + 8);
    const messages = await Promise.all(
      chunk.map((id) => gmailGet<GmailMessage>(token, `messages/${id}?format=full`)),
    );
    for (const msg of messages) {
      const from = header(msg, "From");
      const subject = header(msg, "Subject");
      const dateHdr = header(msg, "Date");
      const texts: string[] = [from, subject, msg.snippet ?? ""];
      await collectText(token, msg.id, msg.payload, texts);
      const blob = texts.join(" \n ").slice(0, 24000);
      if (!looksLikeCharge(from, subject, blob)) continue;

      const matched = matchInboxMerchant(from, subject, blob);
      const merchant = matched.merchant;
      const name = merchant?.name || displayName(from, subject);
      const parsed = parseChargeAmount(blob);
      const local = isLocalCurrency(blob);
      const paidUsd = parsed != null && parsed >= 0.5 && !local;
      const processor = isBillingProcessor(from);
      const free =
        /\b(free trial|free plan|free tier|complimentary|no charge)\b/i.test(blob) && !paidUsd && parsed == null;

      let amount = 0;
      let estimated = false;
      if (paidUsd) {
        amount = parsed!;
      } else if (free) {
        amount = 0;
      } else if (merchant) {
        amount = merchant.typicalPrice;
        estimated = true;
      } else if (parsed != null && !local) {
        amount = parsed;
      } else {
        estimated = true;
      }

      if (!merchant && !paidUsd && !free && !processor) continue;

      const next: InboxFinding = {
        key: findingKey(merchant, name),
        merchant,
        name,
        amount,
        estimated,
        free,
        cycle: guessCycle(blob, merchant?.cycle ?? "monthly"),
        from,
        subject,
        date: dateHdr || (msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null),
        confidence: merchant ? matched.confidence : processor ? 0.6 : 0.5,
      };
      findings.set(next.key, keepFinding(findings.get(next.key), next));
    }
    onProgress?.({
      done: Math.min(i + chunk.length, list.length),
      total: list.length || 1,
      phase: "Reading messages",
    });
  }

  const foundIds = new Set([...findings.values()].map((f) => f.merchant?.id).filter(Boolean) as string[]);
  const missed = INBOX_WATCHLIST_IDS.map((id) => getMerchant(id)).filter((m): m is Merchant => !!m && !foundIds.has(m.id));

  return {
    findings: [...findings.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
    missed,
    scanned: list.length,
    estimate,
    mode: readAll ? "all" : "billing",
  };
}
