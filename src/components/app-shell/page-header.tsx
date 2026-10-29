import type { ReactNode } from "react";
import { MenuButton } from "./nav-menu";

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex h-16 items-center gap-2 border-b px-6 desktop:gap-4">
      <MenuButton />
      <h1 className="truncate text-lg font-semibold">{title}</h1>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
