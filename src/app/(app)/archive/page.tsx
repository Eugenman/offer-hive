import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ArchiveView } from "@/components/archive/archive-view";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    // The page is exactly one screen tall: its content scrolls inside, the page itself does not.
    <div className="flex h-dvh flex-col desktop:h-[calc(100dvh-1rem)]">
      <PageHeader title="Archive" />
      {/* The search lives in the URL, which is only known per request. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<div aria-hidden className="h-96" />}>
          <ArchiveView />
        </Suspense>
      </div>
    </div>
  );
}
