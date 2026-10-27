import { useId, type ReactElement, cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
};

/** Label + control + error/hint, wired for screen readers. */
export function Field({ label, required, error, hint, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden className="text-destructive">*</span> : null}
      </Label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": message ? messageId : undefined,
      })}
      {message ? (
        <p id={messageId} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
