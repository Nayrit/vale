export function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function envGoogleClientId() {
  return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
}
