import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One block of the application page: a bordered card with its title inside. */
export function DetailCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-xl p-4 ring-1 ring-border", className)}>
      <h2 id={id} className="mb-3 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
