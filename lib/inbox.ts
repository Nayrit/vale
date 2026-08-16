import { matchDescriptor, parseAmount } from "./match";
import type { BillingCycle, Merchant } from "./types";

export type InboxFinding = {
  merchant: Merchant;
  amount: number;
  estimated: boolean;
  free: boolean;
  cycle: BillingCycle;
  from: string;
  subject: string;
  date: string | null;
  confidence: number;
};

type GmailMessage = {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
  };
  snippet?: string;
  internalDate?: string;
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

function collectText(part: GmailMessage["payload"] | undefined, into: string[]) {
  if (!part) return;
  if (part.body?.data && (part.mimeType === "text/plain" || part.mimeType === "text/html" || !part.mimeType)) {
    let text = b64url(part.body.data);
    if (part.mimeType === "text/html") {
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ");
    }
    into.push(text);
  }
  for (const child of part.parts ?? []) collectText(child, into);
}

function guessCycle(text: string, fallback: BillingCycle): BillingCycle {
  const t = text.toLowerCase();
  if (/\b(annual|yearly|\/\s*year|per year|billed annually)\b/.test(t)) return "yearly";
  if (/\b(weekly|\/\s*week|per week)\b/.test(t)) return "weekly";
  return fallback;
}

const NOT_A_CHARGE =
  /\b(password|passcode|sign[- ]?in code|verification code|security alert|new device|unusual activity|reset your|two[- ]step|2fa|otp|login code|newsletter|we miss you|weekly digest|confirm your email)\b/i;

const IS_MEMBERSHIP =
  /\b(subscription|subscribed|invoice|renewal|renewed|membership|recurring|you've been charged|you have been charged|payment confirmation|auto[- ]?renew|billed you|your bill|free trial|free plan|free tier|free membership|trial (has )?started|you're subscribed|you are (now )?subscribed)\b/i;

const IS_FREE =
  /\b(free trial|your free trial|start(ed)? your free|free plan|free tier|free membership|complimentary|no charge|no cost|\$0(?:\.00)?|trial (period|started|begins)|on the free (plan|tier)|welcome to .{0,48}(free|student))\b/i;

function isMembershipMail(subject: string, blob: string) {
  const head = `${subject}\n${blob.slice(0, 1200)}`;
  if (NOT_A_CHARGE.test(subject) || NOT_A_CHARGE.test(head)) return false;
  if (IS_MEMBERSHIP.test(subject) || IS_MEMBERSHIP.test(head) || IS_FREE.test(head)) return true;
  return (
    /\breceipt\b/i.test(subject) &&
    /\b(subscription|membership|premium|plus|plan|renew|recurring|monthly|annual|trial)\b/i.test(head)
  );
}

function isFreeMembership(text: string) {
  return IS_FREE.test(text) || /(?:^|[^\d])0\.00\b/.test(text);
}

async function gmailGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) {
    throw new Error(
      "Gmail refused access. In Google Cloud, enable the Gmail API and add the Gmail readonly scope to the OAuth consent screen.",
    );
  }
  if (res.status === 401) throw new Error("Google access expired. Allow inbox access again.");
  if (!res.ok) throw new Error(`Gmail returned ${res.status}.`);
  return res.json() as Promise<T>;
}

async function listIds(token: string, q: string, maxResults: number) {
  const data = await gmailGet<{ messages?: { id: string }[] }>(
    token,
    `messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
  );
  return data.messages?.map((m) => m.id) ?? [];
}

export async function scanGmailInbox(token: string): Promise<InboxFinding[]> {
  const billing =
    'newer_than:18m (subject:subscription OR subject:invoice OR subject:renewal OR subject:membership OR subject:trial OR subject:subscribed OR subject:"payment confirmation" OR subject:"you\'ve been charged" OR subject:receipt OR subject:billing OR "free trial" OR "free plan" OR "you\'re subscribed")';
  const ids = new Set(await listIds(token, billing, 50));
  const list = [...ids].slice(0, 50);
  const findings = new Map<string, InboxFinding>();

  for (let i = 0; i < list.length; i += 6) {
    const chunk = list.slice(i, i + 6);
    const messages = await Promise.all(
      chunk.map((id) => gmailGet<GmailMessage>(token, `messages/${id}?format=full`)),
    );
    for (const msg of messages) {
      const from = header(msg, "From");
      const subject = header(msg, "Subject");
      const dateHdr = header(msg, "Date");
      const texts: string[] = [from, subject, msg.snippet ?? ""];
      collectText(msg.payload, texts);
      const blob = texts.join(" \n ").slice(0, 8000);
      if (!isMembershipMail(subject, blob)) continue;
      const { merchant, confidence } = matchDescriptor(`${from} ${subject}`);
      if (!merchant || confidence < 0.62) continue;
      if (merchant.id === "google-play" && !/\b(subscription|trial)\b/i.test(`${subject} ${blob.slice(0, 800)}`)) {
        continue;
      }
      const head = `${subject}\n${blob.slice(0, 1200)}`;
      const parsed = parseAmount(blob);
      const paid = parsed != null && parsed >= 0.5;
      const freeHint =
        isFreeMembership(head) || /\b(subscribed|free trial|free plan|free tier|trial)\b/i.test(head);
      if (!paid && !freeHint) continue;
      const free = !paid;
      const amount = paid ? parsed! : 0;
      const cycle = guessCycle(blob, merchant.cycle);
      const prev = findings.get(merchant.id);
      const next: InboxFinding = {
        merchant,
        amount,
        estimated: false,
        free,
        cycle,
        from,
        subject,
        date: dateHdr || (msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null),
        confidence,
      };
      if (!prev) findings.set(merchant.id, next);
      else if (prev.free && !next.free) findings.set(merchant.id, next);
      else if (prev.free === next.free && confidence > prev.confidence) findings.set(merchant.id, next);
    }
  }

  return [...findings.values()].sort((a, b) => b.amount - a.amount);
}
