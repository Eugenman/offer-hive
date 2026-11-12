import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Account } from "@/components/app-shell/account";
import { NavMenuProvider } from "@/components/app-shell/nav-menu";
import { NavDrawer, Sidebar } from "@/components/app-shell/sidebar";
import { ScrollDismiss } from "@/components/app-shell/scroll-dismiss";
import { SyncIndicator } from "@/components/app-shell/sync-indicator";
import { Toaster } from "@/components/ui/sonner";
import { RepositoryProvider } from "@/lib/repository/provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <NuqsAdapter>
      <RepositoryProvider>
        <NavMenuProvider>
          {/* `dvh`, not `vh`: on a phone the address bar makes `100vh` taller than the visible
              area, and the pages below size themselves to `100dvh` — the difference was the page
              scrolling by a few dozen pixels, taking the toolbar with it. */}
          <div className="flex min-h-dvh">
            <Sidebar account={<Account />} />
            {/* At 1024px and below the page fills the screen; above it the page is a card next to the sidebar. */}
            <main className="min-w-0 flex-1 desktop:py-2 desktop:pr-2">
              <div className="min-h-dvh bg-background desktop:min-h-[calc(100dvh-1rem)] desktop:rounded-xl desktop:ring-1 desktop:ring-border">
                {children}
              </div>
            </main>
          </div>
          <NavDrawer account={<Account />} />
        </NavMenuProvider>
        <SyncIndicator />
        {/* A swipe that starts on a button must not leave its menu open. */}
        <ScrollDismiss />
        {/* Above the sync indicator in the same corner. */}
        {/* Bottom-right, clear of the column with the company names on the timeline. */}
        <Toaster
          position="bottom-right"
          offset={{ bottom: 24, right: 24 }}
          mobileOffset={{ bottom: 24, right: 12, left: 12 }}
          containerAriaLabel="Notifications"
        />
      </RepositoryProvider>
    </NuqsAdapter>
  );
}
