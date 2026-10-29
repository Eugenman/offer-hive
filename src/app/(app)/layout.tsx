import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { RepositoryProvider } from "@/lib/repository/provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <NuqsAdapter>
      <RepositoryProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 py-2 pr-2">
            <div className="min-h-[calc(100vh-1rem)] rounded-xl bg-background ring-1 ring-border">
              {children}
            </div>
          </main>
        </div>
        <Toaster position="bottom-right" containerAriaLabel="Notifications" />
      </RepositoryProvider>
    </NuqsAdapter>
  );
}
