import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ArchiveView } from "@/components/archive/archive-view";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <>
      <PageHeader title="Archive" />
      {/* The search lives in the URL, which is only known per request. */}
      <Suspense fallback={<div aria-hidden className="h-96" />}>
        <ArchiveView />
      </Suspense>
    </>
  );
}
