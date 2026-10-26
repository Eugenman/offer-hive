import { Sidebar } from "@/components/app-shell/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 py-2 pr-2">
        <div className="min-h-[calc(100vh-1rem)] rounded-xl bg-background ring-1 ring-border">
          {children}
        </div>
      </main>
    </div>
  );
}
