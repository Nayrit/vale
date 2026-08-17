import { getMerchant } from "./catalog";
import {
  matchInboxMerchant,
  parseChargeAmount,
  parseLocalAmount,
  htmlToText,
  isLocalCurrency,
  isPaymentCandidate,
  watchlistHits,
  isStripeSender,
  isSignInOrMarketing,
  type MailHeaders,
} from "./inbox-match";
import {
  isOneTimePurchase,
  isRecurringLanguage,
  selectSubscriptions,
  type ChargeEvent,
} from "./subscription-mail";
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
  kind: "receipt" | "plan" | "account";
  localLabel: string | null;
};

export type InboxMention = {
  merchantId: string;
  name: string;
  from: string;
  subject: string;
};

export type ScanProgress = { done: number; total: number; phase: string };

export type InboxScanResult = {
  findings: InboxFinding[];
  mentions: InboxMention[];
  missed: Merchant[];
  scanned: number;
  estimate: number;
  mode: "all" | "billing";
};

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

function mailHeaders(msg: GmailMessage): MailHeaders {
  return {
    from: header(msg, "From"),
    subject: header(msg, "Subject"),
    listUnsubscribe: header(msg, "List-Unsubscribe"),
    listId: header(msg, "List-Id"),
    precedence: header(msg, "Precedence"),
  };
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
  if (/\b(billed annually|annual plan|annual subscription|\/\s*year|per year|yearly subscription)\b/.test(t)) {
    return "yearly";
  }
  if (/\b(billed weekly|weekly plan|\/\s*week|per week)\b/.test(t)) return "weekly";
  return fallback;
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

function mustFetchQueries() {
  return [
    "newer_than:36m from:stripe.com",
    "newer_than:36m from:invoice.stripe.com",
    "newer_than:36m from:(paypal.com OR paddle.com OR chargebee.com)",
    "newer_than:36m from:(payments-noreply@google.com OR googleone-noreply@google.com)",
    'newer_than:36m (subject:"Receipt from" OR subject:"Your receipt" OR subject:"Invoice from" OR subject:"Google payment" OR subject:subscription)',
  ];
}

function keepFinding(prev: InboxFinding | undefined, next: InboxFinding) {
  if (!prev) return next;
  if (prev.free && !next.free) return next;
  if (!prev.free && next.free) return prev;
  const rank = { receipt: 3, plan: 2, account: 1 };
  if (rank[next.kind] !== rank[prev.kind]) return rank[next.kind] > rank[prev.kind] ? next : prev;
  if (prev.estimated && !next.estimated) return next;
  if (!prev.estimated && next.estimated) return prev;
  if (next.confidence > prev.confidence) return next;
  return prev;
}

function findingKey(merchant: Merchant | null, name: string) {
  return merchant?.id || `raw:${name.trim().toLowerCase()}`;
}

const ALL_MAIL = "in:anywhere -in:chats";
const FULL_READ_CAP = 2000;
const BILLING_CAP = 1200;
const FULL_READ_IF_AT_MOST = 1500;

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

  const mustIds = new Set<string>();
  onProgress?.({ done: 0, total: 1, phase: "Finding payment mail" });
  for (const q of mustFetchQueries()) {
    const extra = await listAllIds(token, q, 250);
    extra.ids.forEach((id) => mustIds.add(id));
  }

  const ids = new Set<string>(mustIds);
  (sample.messages ?? []).forEach((m) => ids.add(m.id));

  if (readAll) {
    onProgress?.({
      done: ids.size,
      total: Math.min(estimate || ids.size, FULL_READ_CAP),
      phase: "Listing every message",
    });
    const rest = await listAllIds(token, ALL_MAIL, FULL_READ_CAP, (count) => {
      onProgress?.({
        done: count,
        total: Math.min(estimate || count, FULL_READ_CAP),
        phase: "Listing every message",
      });
    });
    rest.ids.forEach((id) => ids.add(id));
  } else {
    const queries = [
      "newer_than:36m from:(paypal.com OR paddle.com OR fastspring.com OR chargebee.com)",
      "newer_than:36m from:(payments-noreply@google.com OR googleone-noreply@google.com)",
      "newer_than:36m from:apple.com (subject:receipt OR subject:invoice OR subject:bill OR subject:subscription)",
      "newer_than:36m from:(github.com OR spotify.com OR netflix.com OR adobe.com OR notion.so)",
    ];
    for (let i = 0; i < queries.length; i++) {
      onProgress?.({ done: i, total: queries.length, phase: "Listing receipts" });
      const found = await listAllIds(token, queries[i], 300);
      found.ids.forEach((id) => ids.add(id));
      if (ids.size >= BILLING_CAP) break;
    }
  }

  const cap = readAll ? FULL_READ_CAP : BILLING_CAP;
  const restIds = [...ids].filter((id) => !mustIds.has(id));
  const list = [...mustIds, ...restIds].slice(0, Math.max(cap, mustIds.size));
  const charges: ChargeEvent[] = [];
  const mentions = new Map<string, InboxMention>();
  onProgress?.({ done: 0, total: list.length || 1, phase: "Reading messages" });

  for (let i = 0; i < list.length; i += 8) {
    const chunk = list.slice(i, i + 8);
    const messages = await Promise.all(
      chunk.map((id) => gmailGet<GmailMessage>(token, `messages/${id}?format=full`)),
    );
    for (const msg of messages) {
      const headers = mailHeaders(msg);
      const from = headers.from;
      const subject = headers.subject;
      const texts: string[] = [from, subject, msg.snippet ?? ""];
      await collectText(token, msg.id, msg.payload, texts);
      const blob = texts.join(" \n ").slice(0, 24000);
      const dateMs = msg.internalDate ? Number(msg.internalDate) : Date.parse(header(msg, "Date") || "") || 0;

      if (isSignInOrMarketing(subject) || !isPaymentCandidate(headers, blob)) {
        if (!isSignInOrMarketing(subject)) {
          for (const m of watchlistHits(from, subject)) {
            if (!(INBOX_WATCHLIST_IDS as readonly string[]).includes(m.id)) continue;
            if (!mentions.has(m.id)) mentions.set(m.id, { merchantId: m.id, name: m.name, from, subject });
          }
        }
        continue;
      }

      const matched = matchInboxMerchant(from, subject, blob);
      const merchant = matched.merchant;
      const name = merchant?.name || displayName(from, subject);
      let parsed = parseChargeAmount(blob);
      const local = isLocalCurrency(blob);
      if (parsed == null && isStripeSender(from) && !local) {
        const dollars = [...blob.matchAll(/\$\s*(\d{1,4}(?:,\d{3})*\.\d{2})/g)];
        const last = dollars.at(-1)?.[1];
        if (last) {
          const n = Number(last.replace(/,/g, ""));
          if (Number.isFinite(n) && n >= 0.5 && n < 200) parsed = n;
        }
      }
      const amount = parsed != null && parsed >= 0.5 && parsed < 200 && !local ? parsed : 0;
      const oneTime =
        isOneTimePurchase(subject, blob) ||
        (merchant?.id === "chatgpt" &&
          /\b(api|credits|usage)\b/i.test(blob) &&
          !/\b(chatgpt plus|chatgpt pro|plus plan)\b/i.test(`${subject}\n${blob.slice(0, 1500)}`));

      charges.push({
        merchant,
        name,
        amount,
        cycle: guessCycle(blob, merchant?.cycle ?? "monthly"),
        from,
        subject,
        dateMs,
        recurring: isRecurringLanguage(subject, blob),
        oneTime,
      });
    }
    onProgress?.({
      done: Math.min(i + chunk.length, list.length),
      total: list.length || 1,
      phase: "Reading messages",
    });
  }

  const findings = new Map<string, InboxFinding>();
  for (const event of selectSubscriptions(charges)) {
    const key = findingKey(event.merchant, event.name);
    const local = parseLocalAmount(event.subject);
    const next: InboxFinding = {
      key,
      merchant: event.merchant,
      name: event.name,
      amount: event.amount,
      estimated: false,
      free: false,
      cycle: event.cycle,
      from: event.from,
      subject: event.subject,
      date: event.dateMs ? new Date(event.dateMs).toISOString() : null,
      confidence: event.recurring ? 0.9 : 0.75,
      kind: "receipt",
      localLabel: local?.label ?? null,
    };
    findings.set(key, keepFinding(findings.get(key), next));
  }

  const foundIds = new Set(
    [...findings.values()].map((f) => f.merchant?.id).filter(Boolean) as string[],
  );
  for (const id of foundIds) mentions.delete(id);
  const missed = INBOX_WATCHLIST_IDS.map((id) => getMerchant(id)).filter(
    (m): m is Merchant => !!m && !foundIds.has(m.id) && !mentions.has(m.id),
  );

  return {
    findings: [...findings.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
    mentions: [...mentions.values()].sort((a, b) => a.name.localeCompare(b.name)),
    missed,
    scanned: list.length,
    estimate,
    mode: readAll ? "all" : "billing",
  };
}

export function mergeFindings(live: InboxFinding[], remembered: InboxFinding[]): InboxFinding[] {
  const map = new Map<string, InboxFinding>();
  for (const f of remembered) map.set(f.key, f);
  for (const f of live) map.set(f.key, keepFinding(map.get(f.key), f));
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}
