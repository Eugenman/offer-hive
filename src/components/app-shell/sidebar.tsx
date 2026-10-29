"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  Archive,
  BriefcaseBusiness,
  ChartColumn,
  Hexagon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE, type SidebarState, writeCookie } from "@/lib/ui-prefs";
import { useNavMenu } from "./nav-menu";
import { ThemeMenu } from "./theme-menu";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Other sections that belong to this item, e.g. an application page belongs to "Applications". */
  alsoActiveOn?: string[];
};

const MAIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Applications",
    hint: "All applications: table, kanban, timeline",
    icon: BriefcaseBusiness,
    alsoActiveOn: ["/applications"],
  },
  {
    href: "/statistics",
    label: "Statistics",
    hint: "Funnel, sources and weekly activity",
    icon: ChartColumn,
  },
  {
    href: "/archive",
    label: "Archive",
    hint: "Archived applications, kept for 30 days",
    icon: Archive,
  },
];

const BOTTOM_NAV: NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    hint: "Export, import and your data",
    icon: Settings,
  },
];

const ICON_BUTTON =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

type NavLinkViewProps = { item: NavItem; active: boolean } & Omit<React.ComponentProps<typeof Link>, "href">;

function NavLinkView({ item, active, className, ...props }: NavLinkViewProps) {
  const Icon = item.icon;
  return (
    <Link
      {...props}
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors",
        "hover:bg-background hover:text-foreground",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "bg-background font-medium text-foreground shadow-xs ring-1 ring-border",
        className,
      )}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden />
      <span className="truncate sidebar-collapsed:sr-only">{item.label}</span>
    </Link>
  );
}

/** In the sidebar a link explains itself in a tooltip; in the drawer it closes the drawer. */
function NavLinkWithHint({
  item,
  active,
  current = false,
  inDrawer,
}: {
  item: NavItem;
  active: boolean;
  /** The link leads to the page already open. */
  current?: boolean;
  inDrawer: boolean;
}) {
  const { setOpen } = useNavMenu();
  if (inDrawer) {
    return (
      <NavLinkView
        item={item}
        active={active}
        onClick={(event) => {
          // Navigating to the page already open would reload it and cut the drawer's closing
          // animation short, leaving the dimmed overlay on screen; just close the drawer instead.
          // It also keeps the current filters and view in the URL.
          if (current) event.preventDefault();
          setOpen(false);
        }}
      />
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLinkView item={item} active={active} />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-56">
        <p className="font-medium">{item.label}</p>
        <p className="opacity-80">{item.hint}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Reading the pathname is isolated in the smallest leaf: on routes with dynamic params
// it suspends, and the fallback renders the same link without the active state.
function ActiveNavLink({ item, inDrawer }: { item: NavItem; inDrawer: boolean }) {
  const pathname = usePathname();
  const active = [item.href, ...(item.alsoActiveOn ?? [])].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return <NavLinkWithHint item={item} active={active} current={pathname === item.href} inDrawer={inDrawer} />;
}

function NavLink({ item, inDrawer }: { item: NavItem; inDrawer: boolean }) {
  return (
    <Suspense fallback={<NavLinkWithHint item={item} active={false} inDrawer={inDrawer} />}>
      <ActiveNavLink item={item} inDrawer={inDrawer} />
    </Suspense>
  );
}

/** Logo, navigation, theme and account: the same in the sidebar and in the drawer. */
function SidebarContent({ inDrawer, headerAction }: { inDrawer: boolean; headerAction: React.ReactNode }) {
  const { setOpen } = useNavMenu();
  return (
    <>
      <div className="mb-4 flex items-center gap-2 px-1 sidebar-collapsed:flex-col">
        <Link
          href="/dashboard"
          onClick={
            inDrawer
              ? (event) => {
                  // Same as the nav links: on the page already open, only close the drawer.
                  if (window.location.pathname === "/dashboard") event.preventDefault();
                  setOpen(false);
                }
              : undefined
          }
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Hexagon className="size-6 shrink-0 fill-foreground text-foreground" aria-hidden />
          <span className="truncate text-base font-semibold sidebar-collapsed:sr-only">Offerhive</span>
        </Link>
        {headerAction}
      </div>

      <nav className="flex flex-col gap-1">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} inDrawer={inDrawer} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.href} item={item} inDrawer={inDrawer} />
        ))}
        <ThemeMenu />
        <div className="mt-2 flex items-center gap-3 rounded-lg px-1.5 py-2 sidebar-collapsed:justify-center">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium ring-1 ring-border"
            aria-hidden
          >
            DU
          </span>
          <span className="min-w-0 sidebar-collapsed:sr-only">
            <span className="block truncate text-sm font-medium">Demo user</span>
            <span className="block truncate text-xs text-muted-foreground">Signed in with GitHub</span>
          </span>
        </div>
      </div>
    </>
  );
}

function readSidebarState(): SidebarState {
  if (typeof document === "undefined") return "expanded";
  return document.documentElement.dataset.sidebar === "collapsed" ? "collapsed" : "expanded";
}

/**
 * The sidebar above 1024px; its button collapses or expands it, and the choice is kept in a cookie.
 * At 1024px and below there is only the drawer, opened from the burger in the page header.
 */
export function Sidebar() {
  const [state, setState] = useState<SidebarState>(readSidebarState);

  function toggle() {
    const next: SidebarState = state === "collapsed" ? "expanded" : "collapsed";
    document.documentElement.dataset.sidebar = next;
    writeCookie(SIDEBAR_COOKIE, next);
    setState(next);
  }

  return (
    <aside
      data-rail
      aria-label="Main navigation"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 bg-sidebar px-3 py-4 desktop:flex sidebar-collapsed:w-16"
    >
      <SidebarContent
        inDrawer={false}
        headerAction={
          <button
            type="button"
            onClick={toggle}
            aria-label="Collapse sidebar"
            aria-expanded={state === "expanded"}
            suppressHydrationWarning
            className={ICON_BUTTON}
          >
            <PanelLeftClose className="size-4 sidebar-collapsed:hidden" aria-hidden />
            <PanelLeftOpen className="hidden size-4 sidebar-collapsed:block" aria-hidden />
          </button>
        }
      />
    </aside>
  );
}

/** The full sidebar sliding in from the left over the page, on phones and tablets. */
export function NavDrawer() {
  const { open, setOpen } = useNavMenu();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-1 bg-sidebar px-3 py-4 shadow-lg duration-200 outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left"
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <SidebarContent
            inDrawer
            headerAction={
              <DialogPrimitive.Close aria-label="Close menu" className={ICON_BUTTON}>
                <X className="size-4" aria-hidden />
              </DialogPrimitive.Close>
            }
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
