"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Field, inputClass } from "@/components/ui";
import { authBtn } from "@/components/auth/frame";
import { GOOGLE_PROFILE_SCOPES, googleUserInfo, requestGoogleAccessToken } from "@/lib/google";
import { envGoogleClientId, siteOrigin } from "@/lib/site";

export function GoogleButton({
  label,
  onError,
  onBusy,
}: {
  label: string;
  onError: (message: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const { googleClientId, setGoogleClientId, signInWithGoogle } = useAuth();
  const baked = envGoogleClientId();
  const clientId = baked || googleClientId;
  const [setup, setSetup] = useState(false);
  const [draft, setDraft] = useState(clientId);
  const [busy, setBusy] = useState(false);
  const origin = siteOrigin();

  async function run(id: string) {
    setBusy(true);
    onBusy?.(true);
    try {
      const token = await requestGoogleAccessToken(id, GOOGLE_PROFILE_SCOPES, "select_account");
      const profile = await googleUserInfo(token);
      const result = await signInWithGoogle(profile);
      if (!result.ok) onError(result.error);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Google could not sign you in.");
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  function onClick() {
    onError("");
    if (!clientId) {
      setSetup(true);
      return;
    }
    void run(clientId);
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`${authBtn} bg-white ring-2 ring-[#1a1713]`}
        style={{ color: "#1a1713" }}
      >
        <GoogleMark />
        {busy ? "Connecting…" : label}
      </button>
      {setup && !baked ? (
        <div className="rounded-2xl bg-[#f3eee4] p-4 ring-1 ring-[#1a1713]/10">
          <p className="text-sm leading-relaxed text-[#1a1713]">
            This deploy is missing a Google client ID. In Vercel → Settings → Environment Variables add{" "}
            <span className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span>, then redeploy. In Google Cloud →
            Clients, Authorized JavaScript origins must include <span className="font-mono text-xs">{origin}</span>{" "}
            (no trailing slash).
          </p>
          <Field label="Google client ID">
            <input
              className={inputClass}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="….apps.googleusercontent.com"
              autoComplete="off"
            />
          </Field>
          <button
            type="button"
            className={`${authBtn} mt-3 bg-[#1a1713]`}
            style={{ color: "#ffffff" }}
            onClick={() => {
              const id = draft.trim();
              if (!id) {
                onError("Paste a Google client ID first.");
                return;
              }
              setGoogleClientId(id);
              setSetup(false);
              void run(id);
            }}
          >
            Save and continue with Google
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
