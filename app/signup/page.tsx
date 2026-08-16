"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthError, AuthFrame, OrLine, authBtn } from "@/components/auth/frame";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordField, PasswordHint } from "@/components/auth/password-field";
import { useAuth } from "@/components/auth-provider";
import { Field, inputClass } from "@/components/ui";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await signUp({ name, email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
  }

  return (
    <AuthFrame
      kicker="New ledger"
      title="Create an account"
      lede="Use a real email. After you create the account, Vale asks permission to find subscriptions in that inbox."
    >
      <GoogleButton label="Sign up with Google" onError={setError} onBusy={setBusy} />
      <OrLine />
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Ada"
          />
        </Field>
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
        <PasswordField
          label="Password"
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
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[#3d3830]">
        Already have a ledger?{" "}
        <Link href="/login" className="font-medium text-[#1a1713] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
