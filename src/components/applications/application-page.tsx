"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useRepositoryQuery } from "@/lib/repository/provider";
import { ApplicationFields } from "./detail/application-fields";
import { ApplicationHeader } from "./detail/application-header";
import { InlineEditingProvider } from "./detail/inline-field";
import { StagesSection } from "./detail/stages-section";
import { StatusLog } from "./detail/status-log";

export function ApplicationPage({ id }: { id: string }) {
  const { data, loading } = useRepositoryQuery(`application:${id}`, (repository) => repository.get(id));
  useDocumentTitle(
    data === undefined ? null : data ? `${data.company} · Offerhive` : "Отклик не найден · Offerhive",
  );

  if (data === undefined && loading) {
    return <div aria-hidden className="h-32 border-b" />;
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Отклик не найден" />
        <p className="px-6 py-8 text-sm text-muted-foreground">
          Возможно, его удалили.{" "}
          <Link href="/dashboard" className="text-foreground underline underline-offset-4">
            Вернуться к откликам
          </Link>
        </p>
      </>
    );
  }

  return (
    <InlineEditingProvider>
      <ApplicationHeader app={data} />
      <div className="grid gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-4">
          <ApplicationFields app={data} />
          <StatusLog app={data} />
        </div>
        <StagesSection app={data} />
      </div>
    </InlineEditingProvider>
  );
}
