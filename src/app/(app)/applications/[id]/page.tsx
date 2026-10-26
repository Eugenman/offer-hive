import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { MOCK_APPLICATIONS } from "@/lib/mock-data";

async function ApplicationContent({ params }: Pick<PageProps<"/applications/[id]">, "params">) {
  const { id } = await params;
  const app = MOCK_APPLICATIONS.find((item) => item.id === id);
  if (!app) notFound();
  return (
    <>
      <PageHeader title={`${app.company} · ${app.position}`} />
      <p className="px-6 py-8 text-sm text-muted-foreground">Вёрстка страницы отклика — следующий шаг.</p>
    </>
  );
}

export default function ApplicationPage(props: PageProps<"/applications/[id]">) {
  return (
    <Suspense fallback={<div className="h-16 border-b" />}>
      <ApplicationContent params={props.params} />
    </Suspense>
  );
}
