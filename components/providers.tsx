"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { Shell } from "./shell";
import { StoreProvider } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <AuthProvider>
        <Shell>{children}</Shell>
      </AuthProvider>
    </StoreProvider>
  );
}
