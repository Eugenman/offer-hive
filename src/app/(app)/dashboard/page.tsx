import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ApplicationsView, TableSkeleton } from "@/components/applications/applications-view";

export const metadata: Metadata = { title: "Applications" };

export default function DashboardPage() {
  return (
    // The page is exactly one screen tall: its content scrolls inside, the page itself does not.
    <div className="flex h-dvh flex-col desktop:h-[calc(100dvh-1rem)]">
      <PageHeader title="Applications" />
      {/* The view reads its state from the URL, which is known only in the browser. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="pt-[68px]">
              <TableSkeleton />
            </div>
          }
        >
          <ApplicationsView />
        </Suspense>
      </div>
    </div>
  );
}
