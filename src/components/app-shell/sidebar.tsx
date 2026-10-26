"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  BriefcaseBusiness,
  ChartColumn,
  Hexagon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE, type SidebarState, writeCookie } from "@/lib/ui-prefs";
import { ThemeMenu } from "./theme-menu";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
};

const MAIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Отклики",
    hint: "Все отклики: таблица, канбан, список, таймлайн",
    icon: BriefcaseBusiness,
  },
  {
    href: "/statistics",
    label: "Статистика",
    hint: "Воронка, источники и динамика по неделям",
    icon: ChartColumn,
  },
];

const BOTTOM_NAV: NavItem[] = [
  {
    href: "/settings",
    label: "Настройки",
    hint: "Язык, тема, экспорт и аккаунт",
    icon: Settings,
  },
];

type NavLinkViewProps = { item: NavItem; active: boolean } & Omit<
  React.ComponentProps<typeof Link>,
  "href"
>;

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

function NavLinkWithHint({ item, active }: { item: NavItem; active: boolean }) {
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
function ActiveNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return <NavLinkWithHint item={item} active={active} />;
}

function NavLink({ item }: { item: NavItem }) {
  return (
    <Suspense fallback={<NavLinkWithHint item={item} active={false} />}>
      <ActiveNavLink item={item} />
    </Suspense>
  );
}

function readSidebarState(): SidebarState {
  if (typeof document === "undefined") return "expanded";
  return document.documentElement.dataset.sidebar === "collapsed" ? "collapsed" : "expanded";
}

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
      aria-label="Основная навигация"
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-1 bg-sidebar px-3 py-4 sidebar-collapsed:w-16"
    >
      <div className="mb-4 flex items-center gap-2 px-1 sidebar-collapsed:flex-col">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Hexagon className="size-6 shrink-0 fill-foreground text-foreground" aria-hidden />
          <span className="truncate text-base font-semibold sidebar-collapsed:sr-only">Offerhive</span>
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label="Свернуть боковое меню"
          aria-expanded={state === "expanded"}
          suppressHydrationWarning
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <PanelLeftClose className="size-4 sidebar-collapsed:hidden" aria-hidden />
          <PanelLeftOpen className="hidden size-4 sidebar-collapsed:block" aria-hidden />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        <ThemeMenu />
        <div className="mt-2 flex items-center gap-3 rounded-lg px-1.5 py-2 sidebar-collapsed:justify-center">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium ring-1 ring-border"
            aria-hidden
          >
            ДП
          </span>
          <span className="min-w-0 sidebar-collapsed:sr-only">
            <span className="block truncate text-sm font-medium">Демо-пользователь</span>
            <span className="block truncate text-xs text-muted-foreground">Вход через GitHub</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
