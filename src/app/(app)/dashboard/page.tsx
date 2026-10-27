import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ApplicationsToolbar } from "@/components/applications/applications-toolbar";
import { ApplicationsView } from "@/components/applications/applications-view";

export const metadata: Metadata = { title: "Отклики" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Отклики" />
      <ApplicationsToolbar />
      <ApplicationsView />
    </>
  );
}
