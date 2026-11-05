"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown after sign-up, a reset and a new code from Settings. */
export function RecoveryCodeScreen({
  code,
  emailed,
  onContinue,
  titleAs: Title = "h2",
}: {
  code: string;
  emailed: boolean;
  onContinue: () => void;
  /** A dialog passes its own title, so the code screen is named for screen readers. */
  titleAs?: React.ElementType;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <div className="grid gap-5" data-recovery-code>
      <Title className="text-xl font-semibold">Save your recovery code</Title>
      <p className="rounded-lg bg-muted px-4 py-3 text-center font-mono text-lg tracking-wider select-all">
        {code}
      </p>
      {emailed ? null : (
        <p role="alert" className="text-sm text-destructive">
          We couldn’t email the code. Copy it now.
        </p>
      )}
      <div className="grid gap-2">
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
