"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/database", label: "Database" },
  { href: "/collections", label: "Collections" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3 sm:px-10">
        <span className="mr-4 flex items-center gap-2">
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
        </span>
        {LINKS.map((link) => {
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
        <ThemeToggle />
      </div>
    </nav>
  );
}
