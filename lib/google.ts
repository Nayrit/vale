const GIS_SRC = "https://accounts.google.com/gsi/client";

export const GOOGLE_PROFILE_SCOPES = "email profile openid";
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (res: { access_token?: string; error?: string; error_description?: string }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;

export function loadGoogleIdentity() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      if (!window.google?.accounts?.oauth2) return;
      settled = true;
      resolve();
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      gisPromise = null;
      reject(new Error("Google failed to load. Check your network, then try again."));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", fail);
      if (window.google?.accounts?.oauth2) finish();
      else window.setTimeout(fail, 15_000);
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = finish;
    script.onerror = fail;
    window.setTimeout(fail, 15_000);
    document.head.appendChild(script);
  });
  return gisPromise;
}

export function requestGoogleAccessToken(clientId: string, scope: string, prompt: "consent" | "select_account" | "") {
  return loadGoogleIdentity().then(
    () =>
      new Promise<string>((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error("Google SDK missing"));
          return;
        }
        let settled = false;
        const done = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        };
        const timer = window.setTimeout(() => {
          done(() =>
            reject(
              new Error(
                "Google did not finish. Allow popups for this site, use http://localhost:3000, and check for a hidden Google window.",
              ),
            ),
          );
        }, 25_000);
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope,
          callback: (res) => {
            const token = res.access_token;
            if (token) done(() => resolve(token));
            else done(() => reject(new Error(res.error_description || res.error || "Google sign-in was cancelled.")));
          },
          error_callback: (err) => {
            const type = err.type || "";
            if (type === "popup_closed") done(() => reject(new Error("Google window was closed before finishing.")));
            else if (type === "popup_failed_to_open")
              done(() => reject(new Error("The Google popup was blocked. Allow popups, then try again.")));
            else done(() => reject(new Error(err.message || "Google sign-in failed.")));
          },
        });
        client.requestAccessToken(prompt ? { prompt } : {});
      }),
  );
}

export async function googleUserInfo(accessToken: string) {
  const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!info.ok) throw new Error("Google would not return your profile.");
  const profile = (await info.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!profile.sub || !profile.email) throw new Error("Google would not return your profile.");
  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    picture: profile.picture ?? null,
  };
}

export function isGmailAddress(email: string) {
  return /@(gmail|googlemail)\.com$/i.test(email.trim());
}
