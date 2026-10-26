import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Настройки" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Настройки" />
      <p className="px-6 py-8 text-sm text-muted-foreground">Вёрстка раздела — следующий шаг.</p>
    </>
  );
}
