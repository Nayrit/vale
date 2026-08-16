"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button, Field, MerchantMark, inputClass, toast } from "@/components/ui";
import { cycleLabel, usd, yearlyOf } from "@/lib/money";
import { GMAIL_READONLY_SCOPE, googleUserInfo, isGmailAddress, requestGoogleAccessToken } from "@/lib/google";
import { scanGmailInbox, type InboxFinding } from "@/lib/inbox";
import { useStore } from "@/lib/store";

export default function InboxPage() {
  const router = useRouter();
  const { user, googleClientId, setGoogleClientId } = useAuth();
  const { importInbox, setInboxPrompt } = useStore();
  const [step, setStep] = useState<"ask" | "scan" | "review">("ask");
  const [findings, setFindings] = useState<InboxFinding[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState(googleClientId);
  const email = user?.email ?? "";
  const gmailLike = isGmailAddress(email) || user?.provider === "google";

  const chosen = useMemo(
    () => findings.filter((f) => selected[f.merchant.id] ?? true),
    [findings, selected],
  );
  const monthly = chosen.reduce((sum, f) => {
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
      const found = await scanGmailInbox(token);
      setFindings(found);
      setSelected(Object.fromEntries(found.map((f) => [f.merchant.id, true])));
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
        merchantId: f.merchant.id,
        name: f.merchant.name,
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
      <h1 className="serif mt-3 text-5xl leading-tight">Look for what you pay</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#3d3830]">
        Signed in as <span className="font-medium text-[#1a1713]">{email || "your address"}</span>. Vale will not open
        this mailbox unless you allow it. Permission is read-only: receipts and renewals, not send or delete.
      </p>

      {step === "ask" || step === "scan" ? (
        <div className="mt-10 rounded-[1.8rem] bg-white p-7 ring-1 ring-[#1a1713]/10">
          <ul className="grid gap-3 text-[15px] leading-relaxed text-[#1a1713]">
            <li>Google will ask you to allow read-only access to Gmail for this same address.</li>
            <li>Vale searches receipts and renewal mail from the last 18 months.</li>
            <li>You see each charge — with a price if the mail had one, or a typical price if it did not.</li>
            <li>You pick what to add. Cancel is one tap from the ledger.</li>
          </ul>
          {!gmailLike ? (
            <p className="mt-5 rounded-2xl bg-[#1a1713]/5 px-4 py-3 text-sm leading-relaxed text-[#1a1713]">
              Inbox scan uses Gmail. If {email} is not a Google mailbox (Outlook, Yahoo, iCloud), paste a statement
              instead. If it is Google Workspace, continue and pick that same account.
            </p>
          ) : null}
          {!googleClientId ? (
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
                Enable the Gmail API on that Cloud project, add Gmail readonly to the OAuth consent screen, and set the
                JavaScript origin to this site (http://localhost:3000 in development).
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
              {busy ? "Reading inbox…" : "Allow and scan"}
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
          {findings.length === 0 ? (
            <div className="rounded-[1.6rem] bg-white p-6 ring-1 ring-[#1a1713]/10">
              <p className="leading-relaxed text-[#3d3830]">
                No subscription receipts matched in this inbox. You can paste a statement or add a charge by hand.
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
              <p className="text-lg text-[#1a1713]">
                {chosen.length} selected · {usd(monthly)} / month if they stay
              </p>
              <ul className="mt-6 grid gap-3">
                {findings.map((f) => {
                  const on = selected[f.merchant.id] ?? true;
                  const yearly = yearlyOf(f.amount, f.cycle);
                  return (
                    <li key={f.merchant.id}>
                      <button
                        type="button"
                        onClick={() => setSelected((s) => ({ ...s, [f.merchant.id]: !on }))}
                        className="flex w-full items-center gap-4 rounded-[1.5rem] bg-white p-4 text-left ring-1 ring-[#1a1713]/10"
                      >
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${
                            on ? "bg-[#1a1713] text-white" : "ring-1 ring-[#1a1713]/30"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <MerchantMark merchantId={f.merchant.id} name={f.merchant.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{f.merchant.name}</span>
                          <span className="block truncate text-sm text-[#3d3830]">{f.subject || f.from}</span>
                        </span>
                        <span className="text-right">
                          <span className="serif block text-xl">
                            {usd(f.amount)}
                            <span className="ml-1 text-sm text-[#3d3830]">/{cycleLabel(f.cycle)}</span>
                          </span>
                          <span className="block text-[11px] uppercase tracking-[0.14em] text-[#3d3830]">
                            {f.estimated ? "typical price" : `${usd(yearly)} / year`}
                          </span>
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
        </div>
      ) : null}
    </div>
  );
}
