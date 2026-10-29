"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useRepositoryQuery } from "@/lib/repository/provider";
import { ArchivedApplication } from "../archive/archived-application";
import { ApplicationFields } from "./detail/application-fields";
import { ApplicationHeader } from "./detail/application-header";
import { InlineEditingProvider } from "./detail/inline-field";
import { StagesSection } from "./detail/stages-section";
import { StatusLog } from "./detail/status-log";

/**
 * A live application lives at /applications/[id], an archived one at /archive/[id] (read-only), so
 * the sidebar highlights the right section. A link to the other address is corrected on open, and
 * restoring an archived application moves it back to /applications.
 */
export function ApplicationPage({
  id,
  section = "applications",
}: {
  id: string;
  section?: "applications" | "archive";
}) {
  const router = useRouter();
  // A live application first; an archived one opens read-only with Restore / Delete forever.
  const { data: found, loading } = useRepositoryQuery(`application:${id}`, async (repository) => {
    const live = await repository.get(id);
    if (live) return { archived: false as const, app: live };
    const archived = await repository.getArchived(id);
    return archived ? { archived: true as const, app: archived, now: Date.now() } : null;
  });
  const data = found?.app ?? (found === null ? null : undefined);
  const misplaced = found ? found.archived !== (section === "archive") : false;

  useEffect(() => {
    if (found && misplaced) router.replace(`/${found.archived ? "archive" : "applications"}/${id}`);
  }, [found, misplaced, id, router]);
  useDocumentTitle(
    data === undefined ? null : data ? `${data.company} · Offerhive` : "Application not found · Offerhive",
  );

  if ((data === undefined && loading) || misplaced) {
    return <div aria-hidden className="h-32 border-b" />;
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Application not found" />
        <p className="px-6 py-8 text-sm text-muted-foreground">
          It may have been deleted.{" "}
          <Link href="/dashboard" className="text-foreground underline underline-offset-4">
            Back to applications
          </Link>
        </p>
      </>
    );
  }

  if (found?.archived) return <ArchivedApplication app={found.app} now={found.now} />;

  return (
    <InlineEditingProvider>
      <ApplicationHeader app={data} />
      <div className="grid gap-4 px-6 py-6 desktop:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-4">
          <ApplicationFields app={data} />
          <StatusLog app={data} />
        </div>
        <StagesSection app={data} />
      </div>
    </InlineEditingProvider>
  );
}
