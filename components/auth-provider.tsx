"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  getAuthSnapshot,
  getServerAuthSnapshot,
  requestReset,
  resetPassword,
  setGoogleClientId,
  signIn,
  signInWithGoogle,
  signOut as signOutAuth,
  signUp,
  subscribeAuth,
  type AuthResult,
  type AuthUser,
} from "@/lib/auth";
import { useStore } from "@/lib/store";

type AuthCtx = {
  ready: boolean;
  user: AuthUser | null;
  googleClientId: string;
  setGoogleClientId: (id: string) => void;
  signUp: (input: { name: string; email: string; password: string }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  signInWithGoogle: (profile: {
    googleId: string;
    email: string;
    name: string;
    picture: string | null;
  }) => Promise<AuthResult>;
  requestReset: typeof requestReset;
  resetPassword: typeof resetPassword;
  signOut: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const snap = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);
  const { switchUser, unloadUser } = useStore();

  useEffect(() => {
    if (!ready) return;
    if (snap.user) {
      switchUser(snap.user.id, { name: snap.user.name, email: snap.user.email });
    } else {
      unloadUser();
    }
  }, [ready, snap.user, switchUser, unloadUser]);

  const signOut = useCallback(() => {
    signOutAuth();
  }, []);

  const signUpAndLoad = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await signUp(input);
      if (result.ok) switchUser(result.user.id, { name: result.user.name, email: result.user.email });
      return result;
    },
    [switchUser],
  );

  const signInAndLoad = useCallback(
    async (input: { email: string; password: string }) => {
      const result = await signIn(input);
      if (result.ok) switchUser(result.user.id, { name: result.user.name, email: result.user.email });
      return result;
    },
    [switchUser],
  );

  const signInWithGoogleAndLoad = useCallback(
    async (profile: { googleId: string; email: string; name: string; picture: string | null }) => {
      const result = await signInWithGoogle(profile);
      if (result.ok) switchUser(result.user.id, { name: result.user.name, email: result.user.email });
      return result;
    },
    [switchUser],
  );

  const value = useMemo<AuthCtx>(
    () => ({
      ready,
      user: snap.user,
      googleClientId: snap.googleClientId,
      setGoogleClientId,
      signUp: signUpAndLoad,
      signIn: signInAndLoad,
      signInWithGoogle: signInWithGoogleAndLoad,
      requestReset,
      resetPassword,
      signOut,
    }),
    [ready, snap.user, snap.googleClientId, signUpAndLoad, signInAndLoad, signInWithGoogleAndLoad, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
