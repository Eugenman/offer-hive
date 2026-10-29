import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ApplicationsView, TableSkeleton } from "@/components/applications/applications-view";

export const metadata: Metadata = { title: "Applications" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Applications" />
      {/* The view reads its state from the URL, which is known only in the browser. */}
      <Suspense
        fallback={
          <div className="pt-[68px]">
            <TableSkeleton />
          </div>
        }
      >
        <ApplicationsView />
      </Suspense>
    </>
  );
}
