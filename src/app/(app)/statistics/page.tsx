import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatisticsView } from "@/components/statistics/statistics-view";

export const metadata: Metadata = { title: "Statistics" };

export default function StatisticsPage() {
  return (
    <>
      <PageHeader title="Statistics" />
      <StatisticsView />
    </>
  );
}
