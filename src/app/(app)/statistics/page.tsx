import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Статистика" };

export default function StatisticsPage() {
  return (
    <>
      <PageHeader title="Статистика" />
      <p className="px-6 py-8 text-sm text-muted-foreground">Вёрстка раздела — следующий шаг.</p>
    </>
  );
}
