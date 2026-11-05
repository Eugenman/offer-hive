"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/settings/account", label: "Account", icon: UserRound },
  { href: "/settings/data", label: "Data", icon: Database },
  { href: "/settings/privacy", label: "Privacy", icon: ShieldCheck },
] as const;

/** Settings sections: a list on the left on wide screens, tabs at the top on narrow ones. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings sections"
      className="-mx-6 flex gap-1 overflow-x-auto border-b px-6 desktop:mx-0 desktop:w-48 desktop:shrink-0 desktop:flex-col desktop:border-0 desktop:px-0"
    >
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const current = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2.5 px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              // Narrow screens: tabs with an underline. Wide screens: a list with a filled current item.
              "-mb-px border-b-2 border-transparent desktop:mb-0 desktop:rounded-lg desktop:border-0 desktop:hover:bg-muted",
              current && "border-foreground font-medium text-foreground desktop:bg-muted",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
