import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Account } from "@/components/app-shell/account";
import { NavMenuProvider } from "@/components/app-shell/nav-menu";
import { NavDrawer, Sidebar } from "@/components/app-shell/sidebar";
import { SyncIndicator } from "@/components/app-shell/sync-indicator";
import { Toaster } from "@/components/ui/sonner";
import { RepositoryProvider } from "@/lib/repository/provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <NuqsAdapter>
      <RepositoryProvider>
        <NavMenuProvider>
          <div className="flex min-h-screen">
            <Sidebar account={<Account />} />
            {/* At 1024px and below the page fills the screen; above it the page is a card next to the sidebar. */}
            <main className="min-w-0 flex-1 desktop:py-2 desktop:pr-2">
              <div className="min-h-screen bg-background desktop:min-h-[calc(100vh-1rem)] desktop:rounded-xl desktop:ring-1 desktop:ring-border">
                {children}
              </div>
            </main>
          </div>
          <NavDrawer account={<Account />} />
        </NavMenuProvider>
        <SyncIndicator />
        {/* Above the sync indicator in the same corner. */}
        <Toaster
          position="bottom-right"
          offset={{ bottom: 64 }}
          mobileOffset={{ bottom: 64 }}
          containerAriaLabel="Notifications"
        />
      </RepositoryProvider>
    </NuqsAdapter>
  );
}
