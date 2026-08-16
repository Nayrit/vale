"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthError, AuthFrame, authBtn } from "@/components/auth/frame";
import { PasswordField, PasswordHint } from "@/components/auth/password-field";
import { useAuth } from "@/components/auth-provider";
import { Field, inputClass } from "@/components/ui";

export default function ForgotPage() {
  const router = useRouter();
  const { requestReset, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleOnly, setGoogleOnly] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await requestReset(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.googleOnly) {
      setGoogleOnly(true);
      return;
    }
    setIssued(result.code);
    setEmail(result.email);
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await resetPassword({ email, code, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace("/login");
  }

  if (googleOnly) {
    return (
      <AuthFrame
        kicker="Google account"
        title="No password to reset"
        lede="This ledger was created with Google. There is nothing to email."
      >
        <p className="text-[15px] leading-relaxed text-[#3d3830]">
          Sign in with the same Google account. Vale never asked you for a password, so there is none to recover.
        </p>
        <Link
          href="/login"
          className={`${authBtn} mt-8 bg-[#1a1713]`}
          style={{ color: "#ffffff" }}
        >
          Back to sign in
        </Link>
      </AuthFrame>
    );
  }

  if (issued) {
    return (
      <AuthFrame
        kicker="Reset code"
        title="Set a new password"
        lede="Accounts live on this device, so Vale cannot send mail. Your code is shown once."
      >
        <div className="rounded-2xl bg-[#f3eee4] px-4 py-5 text-center ring-1 ring-[#1a1713]/10">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#3d3830]">One-time code</p>
          <p className="serif mt-2 text-4xl tracking-[0.3em] text-[#1a1713]">{issued}</p>
          <p className="mt-2 text-xs text-[#3d3830]">Expires in 15 minutes</p>
        </div>
        <form onSubmit={onReset} className="mt-6 grid gap-4">
          <Field label="Code">
            <input
              className={`${inputClass} tracking-[0.4em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
            />
          </Field>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordHint password={password} />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <AuthError message={error} />
          <button
            type="submit"
            disabled={busy}
            className={`${authBtn} bg-[#1a1713]`}
            style={{ color: "#ffffff" }}
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-[#1a1713] underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      kicker="Forgot password"
      title="Recover your ledger"
      lede="Enter the email on the account. Vale will issue a device code — it does not send email."
    >
      <form onSubmit={onRequest} className="grid gap-4">
        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="ada@example.com"
          />
        </Field>
        <AuthError message={error} />
        <button
          type="submit"
          disabled={busy}
          className={`${authBtn} bg-[#1a1713]`}
          style={{ color: "#ffffff" }}
        >
          {busy ? "Checking…" : "Send reset code"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-[#1a1713] underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
