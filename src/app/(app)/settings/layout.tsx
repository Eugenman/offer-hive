import { PageHeader } from "@/components/app-shell/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6 px-6 py-6 desktop:flex-row desktop:gap-10">
        <SettingsNav />
        <div className="max-w-3xl min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
