import { merchants } from "./catalog";
import { matchDescriptor, parseAmount } from "./match";
import type { BillingCycle, Merchant } from "./types";

export type InboxFinding = {
  merchant: Merchant;
  amount: number;
  estimated: boolean;
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

function merchantHosts() {
  const hosts = new Set<string>();
  for (const m of merchants) {
    for (const url of [m.manageUrl, m.cancelUrl]) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (host && !host.includes("apple.com") && !host.includes("google.com")) hosts.add(host);
      } catch {
        /* ignore */
      }
    }
  }
  return [...hosts];
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
  const hosts = merchantHosts();
  const billing =
    "newer_than:18m (subject:subscription OR subject:receipt OR subject:invoice OR subject:renewal OR subject:membership OR \"you've been charged\" OR \"recurring payment\" OR \"payment confirmation\" OR \"billing\")";
  const ids = new Set<string>();
  const hostQueries: string[] = [];
  for (let i = 0; i < hosts.length; i += 12) {
    hostQueries.push(hosts.slice(i, i + 12).map((h) => `from:${h}`).join(" OR "));
  }
  for (const q of [billing, ...hostQueries.map((chunk) => `newer_than:18m (${chunk})`)]) {
    const found = await listIds(token, q, 40);
    found.forEach((id) => ids.add(id));
    if (ids.size >= 60) break;
  }

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
      const { merchant, confidence } = matchDescriptor(`${from} ${subject} ${msg.snippet ?? ""}`);
      if (!merchant || confidence < 0.55) continue;
      const amount = parseAmount(blob) ?? merchant.typicalPrice;
      const estimated = parseAmount(blob) == null;
      const cycle = guessCycle(blob, merchant.cycle);
      const prev = findings.get(merchant.id);
      if (!prev || confidence > prev.confidence || (!estimated && prev.estimated)) {
        findings.set(merchant.id, {
          merchant,
          amount,
          estimated,
          cycle,
          from,
          subject,
          date: dateHdr || (msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null),
          confidence,
        });
      }
    }
  }

  return [...findings.values()].sort((a, b) => b.amount - a.amount);
}
