"use client";

import { useId } from "react";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-4 border-b pb-8 last:border-0">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Setting({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description: string;
  /** Can't be undone: set apart at the bottom of its section, with a red title. */
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${danger ? "border-t pt-6" : ""}`}>
      <div className="max-w-md">
        <p className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
