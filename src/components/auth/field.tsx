import { Label } from "@/components/ui/label";

/** Label, control and an optional message under it. */
export function AuthField({
  id,
  label,
  message,
  children,
}: {
  id: string;
  label: string;
  message?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {message ? (
        <p id={`${id}-message`} className="text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
