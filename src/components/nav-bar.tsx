"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CurrentUser } from "@/lib/current-user";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/database", label: "Database" },
  { href: "/collections", label: "Collections" },
  { href: "/protocols", label: "Protocols" },
  { href: "/logs", label: "Logs" },
];

export function NavBar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    // A full navigation — proxy.ts needs to see the cleared session
    // cookie, which a client-side route transition wouldn't re-fetch for.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3 sm:px-10">
        <Link href="/" className="mr-4 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a
              small, static nav-bar icon isn't worth next/image's overhead */}
          <img
            src="/logo.png"
            alt=""
            width={39}
            height={44}
            className="theme-invert"
          />
          <span className="text-xl font-semibold">Specibase</span>
        </Link>
        {/* No user means either the visitor hasn't signed in yet or auth
            isn't configured (see .env.example) — proxy.ts is what actually
            enforces this; hiding these links here is just so a signed-out
            visitor isn't shown navigation that will just bounce to
            /login. */}
        {user &&
          LINKS.map((link) => {
            // Exact match everywhere except Projects, where a nested route
            // (a specific project's own tabs) should still show it active —
            // the primary tab now, with the most nested navigation under it.
            const active =
              link.href === "/projects"
                ? pathname === link.href || pathname.startsWith(`${link.href}/`)
                : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.displayName ?? user.email}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
