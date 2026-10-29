"use client";

import { createContext, use, useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type NavMenu = { open: boolean; setOpen: (open: boolean) => void };

const NavMenuContext = createContext<NavMenu | null>(null);

/** Open state of the navigation drawer, shared by the menu buttons and the drawer itself. */
export function NavMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <NavMenuContext value={{ open, setOpen }}>{children}</NavMenuContext>;
}

export function useNavMenu(): NavMenu {
  const menu = use(NavMenuContext);
  if (!menu) throw new Error("useNavMenu must be used inside NavMenuProvider");
  return menu;
}

/** The burger in page headers, at 1024px and below; above it the sidebar is always on screen. */
export function MenuButton({ className }: { className?: string }) {
  const { open, setOpen } = useNavMenu();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open menu"
      aria-expanded={open}
      className={cn(
        "-ml-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none desktop:hidden",
        className,
      )}
    >
      <Menu className="size-5" aria-hidden />
    </button>
  );
}
