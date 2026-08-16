"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthError, AuthFrame, OrLine, authBtn } from "@/components/auth/frame";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordField } from "@/components/auth/password-field";
import { useAuth } from "@/components/auth-provider";
import { Field, inputClass } from "@/components/ui";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn({ email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
  }

  return (
    <AuthFrame
      kicker="Welcome back"
      title="Sign in"
      lede="Sign in with the email you actually use. Vale will then ask to look for subscriptions in that inbox."
    >
      <GoogleButton label="Continue with Google" onError={setError} onBusy={setBusy} />
      <OrLine />
      <form onSubmit={onSubmit} className="grid gap-4">
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
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link href="/forgot" className="text-sm font-medium text-[#1a1713] underline-offset-4 hover:underline">
            Forgot password
          </Link>
        </div>
        <AuthError message={error} />
        <button
          type="submit"
          disabled={busy}
          className={`${authBtn} bg-[#1a1713]`}
          style={{ color: "#ffffff" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[#3d3830]">
        New to Vale?{" "}
        <Link href="/signup" className="font-medium text-[#1a1713] underline-offset-4 hover:underline">
          Create a ledger
        </Link>
      </p>
    </AuthFrame>
  );
}
