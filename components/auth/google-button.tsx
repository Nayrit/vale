"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Field, inputClass } from "@/components/ui";
import { authBtn } from "@/components/auth/frame";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (res: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google failed to load"));
    document.head.appendChild(script);
  });
  return gisPromise;
}

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
  const [setup, setSetup] = useState(false);
  const [draft, setDraft] = useState(googleClientId);
  const [busy, setBusy] = useState(false);

  async function run(clientId: string) {
    setBusy(true);
    onBusy?.(true);
    try {
      await loadGis();
      if (!window.google?.accounts?.oauth2) throw new Error("Google SDK missing");
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile openid",
        callback: async (res) => {
          if (!res.access_token) {
            onError("Google sign-in was cancelled.");
            setBusy(false);
            onBusy?.(false);
            return;
          }
          try {
            const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${res.access_token}` },
            });
            if (!info.ok) throw new Error("profile");
            const profile = (await info.json()) as {
              sub?: string;
              email?: string;
              name?: string;
              picture?: string;
            };
            if (!profile.sub || !profile.email) throw new Error("profile");
            const result = await signInWithGoogle({
              googleId: profile.sub,
              email: profile.email,
              name: profile.name || profile.email,
              picture: profile.picture ?? null,
            });
            if (!result.ok) onError(result.error);
          } catch {
            onError("Google signed in, but Vale could not read your profile.");
          } finally {
            setBusy(false);
            onBusy?.(false);
          }
        },
      });
      client.requestAccessToken({ prompt: "select_account" });
    } catch {
      onError("Google could not load. Check your connection and try again.");
      setBusy(false);
      onBusy?.(false);
    }
  }

  function onClick() {
    onError("");
    if (!googleClientId) {
      setSetup(true);
      return;
    }
    void run(googleClientId);
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`${authBtn} bg-white text-[#1a1713] ring-2 ring-[#1a1713]`}
        style={{ color: "#1a1713" }}
      >
        <GoogleMark />
        {busy ? "Connecting…" : label}
      </button>
      {setup ? (
        <div className="rounded-2xl bg-[#f3eee4] p-4 ring-1 ring-[#1a1713]/10">
          <p className="text-sm leading-relaxed text-[#1a1713]">
            Add a Google Cloud web client ID (Authorized JavaScript origins: this site, e.g. http://localhost:3000). Vale
            only asks Google for your name and email.
          </p>
          <Field label="Google client ID">
            <input
              className={inputClass}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="123.apps.googleusercontent.com"
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
