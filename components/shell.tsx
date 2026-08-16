"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Onboarding } from "@/components/onboarding";
import { useStore } from "@/lib/store";

const links = [
  { href: "/", label: "Home" },
  { href: "/import", label: "Statement" },
  { href: "/catalog", label: "Catalog" },
  { href: "/add", label: "Add" },
  { href: "/savings", label: "Kept" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

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

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="serif text-3xl italic text-muted">Vale</p>
      </div>
    );
  }

  if (!state.onboarded) return <Onboarding />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[13.5rem_1fr]">
      <aside className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-ink/8 bg-paper/90 px-5 py-4 backdrop-blur lg:h-screen lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r lg:px-8 lg:py-10">
        <Link href="/" className="serif text-3xl italic leading-none">
          Vale
        </Link>
        <nav className="flex gap-1 overflow-x-auto text-sm lg:mt-16 lg:flex-col lg:gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 transition lg:rounded-xl ${
                  active ? "bg-ink text-cream" : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <p className="hidden text-xs leading-relaxed text-muted lg:mt-auto lg:block">
          The statement names the charge.
          <br />
          Vale names the door.
        </p>
      </aside>
      <main className="relative px-5 py-8 sm:px-10 lg:px-16 lg:py-14">{children}</main>
      {message ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm text-cream shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}
