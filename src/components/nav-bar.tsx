"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/samples", label: "Add samples" },
  { href: "/database", label: "Database" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3 sm:px-10">
        <span className="mr-4 text-sm font-semibold">Specibase</span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              pathname === link.href
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
