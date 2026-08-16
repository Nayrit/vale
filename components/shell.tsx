"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useStore } from "@/lib/store";

const links = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/import", label: "Statement" },
  { href: "/catalog", label: "Catalog" },
  { href: "/add", label: "Add" },
  { href: "/savings", label: "Kept" },
  { href: "/account", label: "Account" },
];

const AUTH_ROUTES = new Set(["/login", "/signup", "/forgot"]);

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore();
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setMessage(detail);
    };
    window.addEventListener("vale-toast", onToast);
    return () => window.removeEventListener("vale-toast", onToast);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!auth.ready) return;
    if (!auth.user && !isAuthRoute) router.replace("/login");
    if (auth.user && isAuthRoute) {
      const ledgerReady =
        state.profile?.email.trim().toLowerCase() === auth.user.email.trim().toLowerCase();
      if (!ledgerReady) return;
      router.replace(state.inboxPrompt === "pending" ? "/inbox" : "/");
    }
  }, [auth.ready, auth.user, isAuthRoute, router, state.profile?.email, state.inboxPrompt]);

  if (!ready || !auth.ready) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center">
        <p className="serif text-3xl italic text-[#1a1713]">Vale</p>
      </div>
    );
  }

  if (isAuthRoute) {
    if (auth.user) {
      return (
        <div className="relative z-10 grid min-h-screen place-items-center">
          <p className="serif text-3xl italic text-[#1a1713]">Vale</p>
        </div>
      );
    }
    return <>{children}</>;
  }

  if (!auth.user) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center">
        <p className="serif text-3xl italic text-[#1a1713]">Vale</p>
      </div>
    );
  }

  const initial = (auth.user.name || "You").trim().slice(0, 1).toUpperCase();

  return (
    <div className="relative z-10 min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-[#1a1713]/15 bg-[#f3eee4] px-5 py-4 lg:h-screen lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r lg:px-7 lg:py-10">
        <Link href="/" className="serif text-3xl italic leading-none text-[#1a1713]">
          Vale
        </Link>
        <nav className="flex gap-1 overflow-x-auto lg:mt-14 lg:flex-col lg:gap-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2.5 text-[16px] font-medium transition lg:rounded-xl ${
                  active ? "bg-[#1a1713]" : "hover:bg-[#1a1713]/8"
                }`}
                style={{ color: active ? "#ffffff" : "#1a1713" }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/account"
          className={`mt-auto hidden items-center gap-3 rounded-2xl px-3 py-3 lg:flex ${
            pathname === "/account" ? "bg-[#1a1713]" : "hover:bg-[#1a1713]/8"
          }`}
          style={{ color: pathname === "/account" ? "#ffffff" : "#1a1713" }}
        >
          <span
            className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[#2f4a3c] text-sm font-medium"
            style={{ color: "#ffffff" }}
          >
            {auth.user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={auth.user.picture} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{auth.user.name}</span>
            <span className={`block truncate text-xs ${pathname === "/account" ? "text-white/70" : "text-[#3d3830]"}`}>
              Account
            </span>
          </span>
        </Link>
      </aside>
      <main className="relative px-5 py-8 sm:px-10 lg:px-16 lg:py-14">
        {pathname !== "/" ? (
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-[15px] font-medium text-[#1a1713]"
          >
            <span aria-hidden className="text-lg leading-none">
              ←
            </span>
            Home
          </Link>
        ) : null}
        {children}
      </main>
      {message ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1a1713] px-5 py-3 text-sm text-white shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}
