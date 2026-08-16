export type AuthProviderId = "password" | "google";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  picture: string | null;
  provider: AuthProviderId;
  googleId: string | null;
  createdAt: string;
};

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

type StoredUser = AuthUser & {
  passwordHash: string | null;
  passwordSalt: string | null;
  resetCodeHash: string | null;
  resetExpires: number | null;
};

type AuthDisk = {
  users: StoredUser[];
  sessionId: string | null;
  googleClientId: string;
};

const KEY = "vale-auth-v1";

const emptyDisk: AuthDisk = { users: [], sessionId: null, googleClientId: "" };

let disk: AuthDisk = emptyDisk;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  snapshotCache = null;
  localStorage.setItem(KEY, JSON.stringify(disk));
  emit();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<AuthDisk>;
    disk = {
      ...emptyDisk,
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch {
    disk = emptyDisk;
  }
}

function publicUser(u: StoredUser): AuthUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    picture: u.picture,
    provider: u.provider,
    googleId: u.googleId,
    createdAt: u.createdAt,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function findByEmail(email: string) {
  const e = normalizeEmail(email);
  return disk.users.find((u) => u.email === e) ?? null;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(password: string, salt: Uint8Array) {
  const saltCopy = new Uint8Array(salt);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltCopy, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(bits);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return { hash, salt: bytesToHex(salt) };
}

async function verifyPassword(password: string, hash: string, saltHex: string) {
  const next = await derive(password, hexToBytes(saltHex));
  return next === hash;
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function passwordIssue(password: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  return null;
}

export function subscribeAuth(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let snapshotCache: { user: AuthUser | null; googleClientId: string } | null = null;

function currentGoogleClientId() {
  return disk.googleClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
}

export function getAuthSnapshot() {
  load();
  const stored = disk.users.find((u) => u.id === disk.sessionId) ?? null;
  const user = stored ? publicUser(stored) : null;
  const googleClientId = currentGoogleClientId();
  if (
    snapshotCache &&
    snapshotCache.googleClientId === googleClientId &&
    snapshotCache.user?.id === user?.id &&
    snapshotCache.user?.email === user?.email &&
    snapshotCache.user?.name === user?.name &&
    snapshotCache.user?.picture === user?.picture
  ) {
    return snapshotCache;
  }
  snapshotCache = { user, googleClientId };
  return snapshotCache;
}

const serverAuthSnapshot = {
  user: null as AuthUser | null,
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
};

export function getServerAuthSnapshot() {
  return serverAuthSnapshot;
}

export function setGoogleClientId(id: string) {
  load();
  disk.googleClientId = id.trim();
  persist();
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  load();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) return { ok: false, error: "Add your name." };
  if (!validEmail(email)) return { ok: false, error: "That email does not look right." };
  const issue = passwordIssue(input.password);
  if (issue) return { ok: false, error: issue };
  if (findByEmail(email)) return { ok: false, error: "That email already has a Vale ledger. Sign in instead." };
  const { hash, salt } = await hashPassword(input.password);
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    picture: null,
    provider: "password",
    googleId: null,
    createdAt: new Date().toISOString(),
    passwordHash: hash,
    passwordSalt: salt,
    resetCodeHash: null,
    resetExpires: null,
  };
  disk.users.push(user);
  disk.sessionId = user.id;
  persist();
  return { ok: true, user: publicUser(user) };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  load();
  const user = findByEmail(input.email);
  if (!user) return { ok: false, error: "No ledger for that email." };
  if (!user.passwordHash || !user.passwordSalt) {
    return { ok: false, error: "This ledger uses Google. Continue with Google." };
  }
  const good = await verifyPassword(input.password, user.passwordHash, user.passwordSalt);
  if (!good) return { ok: false, error: "Wrong password." };
  disk.sessionId = user.id;
  persist();
  return { ok: true, user: publicUser(user) };
}

export async function signInWithGoogle(profile: {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}): Promise<AuthResult> {
  load();
  const email = normalizeEmail(profile.email);
  if (!validEmail(email)) return { ok: false, error: "Google did not return a usable email." };
  let user = disk.users.find((u) => u.googleId === profile.googleId) ?? findByEmail(email);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      name: profile.name.trim() || email.split("@")[0],
      email,
      picture: profile.picture,
      provider: "google",
      googleId: profile.googleId,
      createdAt: new Date().toISOString(),
      passwordHash: null,
      passwordSalt: null,
      resetCodeHash: null,
      resetExpires: null,
    };
    disk.users.push(user);
  } else {
    user.googleId = profile.googleId;
    user.picture = profile.picture ?? user.picture;
    if (!user.name) user.name = profile.name;
    if (user.provider !== "password") user.provider = "google";
  }
  disk.sessionId = user.id;
  persist();
  return { ok: true, user: publicUser(user) };
}

export async function requestReset(email: string): Promise<
  | { ok: true; googleOnly: true }
  | { ok: true; googleOnly: false; code: string; email: string }
  | { ok: false; error: string }
> {
  load();
  if (!validEmail(email)) return { ok: false, error: "That email does not look right." };
  const user = findByEmail(email);
  if (!user) return { ok: false, error: "No ledger for that email." };
  if (!user.passwordHash) return { ok: true, googleOnly: true };
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const salt = crypto.getRandomValues(new Uint8Array(8));
  user.resetCodeHash = `${bytesToHex(salt)}:${await derive(code, salt)}`;
  user.resetExpires = Date.now() + 15 * 60 * 1000;
  persist();
  return { ok: true, googleOnly: false, code, email: user.email };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<AuthResult> {
  load();
  const user = findByEmail(input.email);
  if (!user || !user.resetCodeHash || !user.resetExpires) {
    return { ok: false, error: "That reset code is not valid." };
  }
  if (Date.now() > user.resetExpires) return { ok: false, error: "That code has expired. Request a new one." };
  const issue = passwordIssue(input.password);
  if (issue) return { ok: false, error: issue };
  const [saltHex, expected] = user.resetCodeHash.split(":");
  const next = await derive(input.code.trim(), hexToBytes(saltHex));
  if (next !== expected) return { ok: false, error: "That code does not match." };
  const { hash, salt } = await hashPassword(input.password);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.resetCodeHash = null;
  user.resetExpires = null;
  user.provider = "password";
  persist();
  return { ok: true, user: publicUser(user) };
}

export function signOut() {
  load();
  disk.sessionId = null;
  persist();
}
