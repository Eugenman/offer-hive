"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Where the policy was opened from decides where "back" leads: the sign-in form, Settings, or the app.
const BACK = {
  login: { href: "/login", label: "Back to sign in" },
  settings: { href: "/settings/privacy", label: "Back to Settings" },
} as const;
const DEFAULT_BACK = { href: "/dashboard", label: "Back to Offerhive" };

export function BackLink() {
  const from = useSearchParams().get("from");
  const back = from === "login" || from === "settings" ? BACK[from] : DEFAULT_BACK;
  return (
    <Link
      href={back.href}
      className="flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {back.label}
    </Link>
  );
}
