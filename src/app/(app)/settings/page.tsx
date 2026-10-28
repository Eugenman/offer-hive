import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Настройки" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Настройки" />
      <SettingsView />
    </>
  );
}
