"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button, Field, MerchantMark, inputClass, toast } from "@/components/ui";
import { cycleLabel, usd, yearlyOf } from "@/lib/money";
import { GMAIL_READONLY_SCOPE, googleUserInfo, isGmailAddress, requestGoogleAccessToken } from "@/lib/google";
import { getMerchant } from "@/lib/catalog";
import { scanGmailInbox, mergeFindings, type InboxFinding, type InboxMention, type InboxScanResult } from "@/lib/inbox";
import { envGoogleClientId, siteOrigin } from "@/lib/site";
import { useStore } from "@/lib/store";
import type { InboxDiscovery } from "@/lib/types";

export default function InboxPage() {
  const router = useRouter();
  const { user, googleClientId, setGoogleClientId } = useAuth();
  const { importInbox, setInboxPrompt, rememberInbox, state } = useStore();
  const [step, setStep] = useState<"ask" | "scan" | "review">("ask");
  const [findings, setFindings] = useState<InboxFinding[]>([]);
  const [mentions, setMentions] = useState<InboxMention[]>([]);
  const [scan, setScan] = useState<Omit<InboxScanResult, "findings" | "mentions"> | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const [draftId, setDraftId] = useState(googleClientId);
  const email = user?.email ?? "";
  const gmailLike = isGmailAddress(email) || user?.provider === "google";

  const chosen = useMemo(
    () => findings.filter((f) => selected[f.key] ?? true),
    [findings, selected],
  );
  const freeCount = chosen.filter((f) => f.free || f.amount === 0).length;
  const monthly = chosen.reduce((sum, f) => {
    if (f.free || f.amount === 0) return sum;
    if (f.cycle === "yearly") return sum + f.amount / 12;
    if (f.cycle === "weekly") return sum + f.amount * 4.345;
    return sum + f.amount;
  }, 0);

  async function allowAndScan() {
    setError(null);
    if (!googleClientId && !draftId.trim()) {
      setError("Add your Google client ID first, then allow access.");
      return;
    }
    const clientId = googleClientId || draftId.trim();
    if (!googleClientId) setGoogleClientId(clientId);
    setBusy(true);
    setStep("scan");
    try {
      const token = await requestGoogleAccessToken(
        clientId,
        `email profile openid ${GMAIL_READONLY_SCOPE}`,
        "consent",
      );
      const profile = await googleUserInfo(token);
      if (profile.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error(`Google opened ${profile.email}. Switch to ${email} so Vale reads the matching inbox.`);
      }
      const result = await scanGmailInbox(token, setProgress);
      const remembered: InboxFinding[] = (state.inboxDiscoveries ?? [])
        .filter((d) => d.kind === "receipt" && !d.estimated && d.amount > 0)
        .map((d) => ({
        key: d.merchantId || `raw:${d.name.trim().toLowerCase()}`,
        merchant: getMerchant(d.merchantId),
        name: d.name,
        amount: d.amount,
        estimated: d.estimated,
        free: d.free,
        cycle: d.cycle,
        from: d.from,
        subject: d.subject,
        date: null,
        confidence: 0.7,
        kind: d.kind,
        localLabel: null,
      }));
      const merged = mergeFindings(result.findings, remembered);
      const foundIds = new Set(merged.map((f) => f.merchant?.id).filter(Boolean) as string[]);
      rememberInbox(
        merged
          .filter((f) => f.kind === "receipt" && !f.estimated && f.amount > 0)
          .map(
          (f): InboxDiscovery => ({
            merchantId: f.merchant?.id ?? null,
            name: f.name,
            amount: f.amount,
            cycle: f.cycle,
            kind: f.kind,
            free: f.free,
            estimated: f.estimated,
            subject: f.subject,
            from: f.from,
          }),
        ),
      );
      setFindings(merged);
      setMentions(result.mentions.filter((m) => !foundIds.has(m.merchantId)));
      setScan({
        missed: result.missed.filter((m) => !foundIds.has(m.id)),
        scanned: result.scanned,
        estimate: result.estimate,
        mode: result.mode,
      });
      setSelected(
        Object.fromEntries(merged.map((f) => [f.key, f.amount > 0 && !f.estimated])),
      );
      setInboxPrompt("allowed");
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vale could not read this inbox.");
      setStep("ask");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    setInboxPrompt("skipped");
    router.push("/");
  }

  function addChosen() {
    const n = importInbox(
      chosen.map((f) => ({
        merchantId: f.merchant?.id ?? null,
        name: f.name,
        amount: f.amount,
        cycle: f.cycle,
        bankDescriptor: f.subject || f.from,
      })),
    );
    toast(n ? `Added ${n} subscription${n === 1 ? "" : "s"} from the inbox.` : "Those were already on the ledger.");
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">Your inbox</p>
      <h1 className="serif mt-3 text-5xl leading-tight">What this inbox holds</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#3d3830]">
        Signed in as <span className="font-medium text-[#1a1713]">{email || "your address"}</span>. Vale lists
        subscriptions — recurring charges. A one-time purchase, a shop receipt, or a sign-in is not a subscription.
      </p>

      {step === "ask" || step === "scan" ? (
        <div className="mt-10 rounded-[1.8rem] bg-white p-7 ring-1 ring-[#1a1713]/10">
          <ul className="grid gap-3 text-[15px] leading-relaxed text-[#1a1713]">
            <li>
              On a mailbox of about 1,500 messages or fewer, Vale reads every message. On a larger one it pages
              through three years of Stripe, PayPal, Apple, Google payments, and mail from Cursor, Claude, ChatGPT,
              and the rest of the watchlist.
            </li>
            <li>
              Google does not give Vale a list of “every subscription on this Gmail.” Cursor, Claude, Netflix and the
              rest only show up if they emailed this address — All Mail and Trash included, not only the inbox.
            </li>
            <li>
              You have = a recurring bill Vale can prove: the mail says subscription / auto-renew / billing period, or
              the same merchant charged more than once, or a known membership (Cursor, Claude, Netflix…) with a real
              payment that is not a one-off. A single shop receipt is a purchase, not a sub.
            </li>
            <li>Password mail, newsletters, and one-off store orders are ignored.</li>
            <li>
              Google will warn that Vale is not verified yet. That is Google’s screen for an unpublished app. If you
              continue, choose Advanced, then Go to Vale. Add this Gmail under Google Cloud → Audience → Test users or
              Google will block it.
            </li>
          </ul>
          {!gmailLike ? (
            <p className="mt-5 rounded-2xl bg-[#1a1713]/5 px-4 py-3 text-sm leading-relaxed text-[#1a1713]">
              Inbox scan uses Gmail. If {email} is not a Google mailbox (Outlook, Yahoo, iCloud), paste a statement
              instead. If it is Google Workspace, continue and pick that same account.
            </p>
          ) : null}
          {!googleClientId && !envGoogleClientId() ? (
            <div className="mt-6">
              <Field label="Google client ID">
                <input
                  className={inputClass}
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  placeholder="….apps.googleusercontent.com"
                />
              </Field>
              <p className="mt-2 text-xs text-[#3d3830]">
                Set NEXT_PUBLIC_GOOGLE_CLIENT_ID on Vercel and redeploy. In Google Cloud, Authorized JavaScript origins
                must include {typeof window !== "undefined" ? siteOrigin() : "this site"} — no trailing slash.
              </p>
            </div>
          ) : null}
          {error ? (
            <p className="mt-5 rounded-2xl bg-[#b44528]/10 px-4 py-3 text-sm font-medium text-[#9a3a22]">{error}</p>
          ) : null}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void allowAndScan()}
              className="rounded-full bg-[#1a1713] px-5 py-3.5 text-[15px] font-medium disabled:opacity-40"
              style={{ color: "#ffffff" }}
            >
              {busy ? (progress ? `${progress.phase} ${progress.done}/${progress.total}` : "Reading inbox…") : "Allow and scan"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={skip}
              className="rounded-full bg-white px-5 py-3.5 text-[15px] font-medium ring-2 ring-[#1a1713]"
              style={{ color: "#1a1713" }}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="mt-10">
          {scan ? (
            <p className="mb-8 text-sm leading-relaxed text-[#3d3830]">
              {scan.mode === "all"
                ? `Vale read all ${scan.scanned} message${scan.scanned === 1 ? "" : "s"} in this mailbox.`
                : `This mailbox is large (~${scan.estimate.toLocaleString()}). Vale read ${scan.scanned} billing and watchlist messages from the last three years.`}
            </p>
          ) : null}

          <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">You have</p>
          {findings.length === 0 ? (
            <div className="mt-3 rounded-[1.6rem] bg-white p-6 ring-1 ring-[#1a1713]/10">
              <p className="leading-relaxed text-[#3d3830]">
                No receipt or plan mail. If something bills a card without emailing this address, paste a statement
                or add it by hand.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button href="/import">Paste a statement</Button>
                <Button href="/add" kind="ghost">
                  Add one by hand
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-3 text-lg text-[#1a1713]">
                {chosen.length} selected · {usd(monthly)} / month if they stay
                {freeCount ? ` · ${freeCount} free` : ""}
              </p>
              <ul className="mt-6 grid gap-3">
                {findings.map((f) => {
                  const on = selected[f.key] ?? true;
                  const yearly = yearlyOf(f.amount, f.cycle);
                  return (
                    <li key={f.key}>
                      <button
                        type="button"
                        onClick={() => setSelected((s) => ({ ...s, [f.key]: !on }))}
                        className="flex w-full items-center gap-4 rounded-[1.5rem] bg-white p-4 text-left ring-1 ring-[#1a1713]/10"
                      >
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${
                            on ? "bg-[#1a1713] text-white" : "ring-1 ring-[#1a1713]/30"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <MerchantMark merchantId={f.merchant?.id} name={f.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{f.name}</span>
                          <span className="block truncate text-sm text-[#3d3830]">{f.subject || f.from}</span>
                          <span className="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-[#3d3830]">
                            {f.kind === "account"
                              ? "on this inbox · no receipt found"
                              : f.kind === "plan"
                                ? "plan mail"
                                : "receipt"}
                            {f.localLabel ? ` · billed ${f.localLabel}` : ""}
                          </span>
                        </span>
                        <span className="text-right">
                          {f.free ? (
                            <>
                              <span className="serif block text-xl">Free</span>
                              <span className="block text-[11px] uppercase tracking-[0.14em] text-[#3d3830]">
                                no charge yet
                              </span>
                            </>
                          ) : f.amount === 0 ? (
                            <>
                              <span className="serif block text-xl">In mail</span>
                              <span className="block text-[11px] uppercase tracking-[0.14em] text-[#3d3830]">
                                amount unclear
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="serif block text-xl">
                                {usd(f.amount)}
                                <span className="ml-1 text-sm text-[#3d3830]">/{cycleLabel(f.cycle)}</span>
                              </span>
                              <span className="block text-[11px] uppercase tracking-[0.14em] text-[#3d3830]">
                                {f.kind === "account"
                                  ? "typical — set what you pay"
                                  : f.estimated
                                    ? "typical price"
                                    : `${usd(yearly)} / year`}
                              </span>
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={addChosen}
                className="mt-8 w-full rounded-full bg-[#1a1713] px-5 py-3.5 text-[15px] font-medium"
                style={{ color: "#ffffff" }}
              >
                Add to ledger
              </button>
            </>
          )}

          {mentions.length > 0 ? (
            <div className="mt-12">
              <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">
                Named in mail, not a bill
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#3d3830]">
                Mail named these. There was no charge Vale could prove — sign-in, marketing, or a one-off receipt.
              </p>
              <ul className="mt-5 grid gap-3">
                {mentions.map((m) => (
                  <li
                    key={m.merchantId}
                    className="flex items-center gap-4 rounded-[1.5rem] bg-white p-4 ring-1 ring-[#1a1713]/10"
                  >
                    <MerchantMark merchantId={m.merchantId} name={m.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{m.name}</span>
                      <span className="block truncate text-sm text-[#3d3830]">{m.subject || m.from}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {scan && scan.missed.length > 0 ? (
            <div className="mt-12 rounded-[1.6rem] bg-white p-6 ring-1 ring-[#1a1713]/10">
              <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#3d3830]">Not in this inbox</p>
              <p className="mt-2 text-sm leading-relaxed text-[#3d3830]">
                No receipt, plan mail, or even a subject line. This address likely does not pay for these — or they
                bill somewhere else.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {scan.missed.map((m) => (
                  <li key={m.id} className="rounded-full bg-[#1a1713]/5 px-3 py-1.5 text-sm text-[#1a1713]">
                    {m.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
