"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const tab = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        path === href ? "bg-ink text-bg" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-auto font-display text-2xl tracking-tight">
          Swap<span className="text-accent">Cal</span>
        </Link>
        {tab("/", "Calculator")}
        {tab("/library", "Library")}
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/login");
          }}
          className="ml-1 text-sm text-muted hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
