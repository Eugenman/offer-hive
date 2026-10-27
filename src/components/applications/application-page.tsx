"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useRepositoryQuery } from "@/lib/repository/provider";

export function ApplicationPage({ id }: { id: string }) {
  const { data, loading } = useRepositoryQuery(`application:${id}`, (repository) =>
    repository.get(id),
  );

  if (data === undefined && loading) {
    return <div aria-hidden className="h-16 border-b" />;
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

  return <PageHeader title={`${data.company} · ${data.position}`} />;
}
