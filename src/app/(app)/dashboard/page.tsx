import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { ApplicationsToolbar } from "@/components/applications/applications-toolbar";
import { TableFooter } from "@/components/applications/table-footer";
import { MOCK_APPLICATIONS } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Отклики" };

export default function DashboardPage() {
  const applications = MOCK_APPLICATIONS;
  return (
    <>
      <PageHeader title="Отклики" />
      <ApplicationsToolbar />
      <ApplicationsTable applications={applications} />
      <TableFooter total={applications.length} />
    </>
  );
}
