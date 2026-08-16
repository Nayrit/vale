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
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google failed to load"));
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
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope,
          callback: (res) => {
            if (res.access_token) resolve(res.access_token);
            else reject(new Error(res.error_description || res.error || "Google sign-in was cancelled."));
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
  if (!info.ok) throw new Error("profile");
  const profile = (await info.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!profile.sub || !profile.email) throw new Error("profile");
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
