"use client";

import { useId, useState } from "react";
import { KeyRound } from "lucide-react";
import { AuthField } from "@/components/auth/field";
import { PasswordInput } from "@/components/auth/password-input";
import { RecoveryCodeScreen } from "@/components/auth/recovery-code-screen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createNewRecoveryCode, type CodeResult } from "@/lib/auth/actions";
import { DeleteAccount } from "./delete-account";
import { Section, Setting } from "./section";

export function AccountSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Account">
      <Setting title="Email" description={email} />
      <Setting
        title="Recovery code"
        description="Resets your password if you forget it. A new code replaces the old one."
      >
        <Button variant="outline" onClick={() => setOpen(true)}>
          <KeyRound aria-hidden />
          Create new recovery code
        </Button>
      </Setting>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          {/* A new form each time the dialog opens: no password or code left from the last time. */}
          {open ? <NewCodeForm onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
      <DeleteAccount />
    </Section>
  );
}

function NewCodeForm({ onDone }: { onDone: () => void }) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [issued, setIssued] = useState<CodeResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await createNewRecoveryCode({ password });
      if (result.ok) setIssued(result);
      else if (result.reason === "wrong_password") setWrong(true);
      else setError("You’re signed out. Sign in again.");
    } catch {
      setError("Couldn’t create a new code.");
    } finally {
      setPending(false);
    }
  }

  if (issued) {
    return (
      <RecoveryCodeScreen
        code={issued.code}
        emailed={issued.emailed}
        onContinue={onDone}
        titleAs={DialogTitle}
      />
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Create new recovery code</DialogTitle>
        <DialogDescription>Your current code stops working.</DialogDescription>
      </DialogHeader>
      <AuthField id={`${id}-password`} label="Current password" message={wrong ? "Wrong password." : null}>
        <PasswordInput
          id={`${id}-password`}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setWrong(false);
          }}
          aria-invalid={wrong || undefined}
          aria-describedby={wrong ? `${id}-password-message` : undefined}
          required
        />
      </AuthField>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={pending || password === ""}>
          Create code
        </Button>
      </DialogFooter>
    </form>
  );
}
