"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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

  const value = useMemo<AuthCtx>(
    () => ({
      ready,
      user: snap.user,
      googleClientId: snap.googleClientId,
      setGoogleClientId,
      signUp,
      signIn,
      signInWithGoogle,
      requestReset,
      resetPassword,
      signOut,
    }),
    [ready, snap.user, snap.googleClientId, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
