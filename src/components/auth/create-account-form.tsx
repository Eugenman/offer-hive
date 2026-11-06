"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAccount, type CodeResult } from "@/lib/auth/actions";
import { AuthField } from "./field";
import { openApp, safeNext } from "./next-path";
import { PasswordInput } from "./password-input";
import { RecoveryCodeScreen } from "./recovery-code-screen";

const MIN_PASSWORD_LENGTH = 10;

export function CreateAccountForm() {
  const params = useSearchParams();
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [issued, setIssued] = useState<CodeResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setTooShort(true);
      return;
    }
    setPending(true);
    setError(null);
    const result = await createAccount({ email, password });
    setPending(false);
    if (result.ok) setIssued(result);
    else if (result.reason === "short_password") setTooShort(true);
    else setError("Couldn’t create the account.");
  }

  if (issued) {
    return (
      <RecoveryCodeScreen
        code={issued.code}
        emailed={issued.emailed}
        onContinue={() => {
          openApp(safeNext(params.get("next")));
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <AuthField id={`${id}-email`} label="Email">
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </AuthField>
      <AuthField id={`${id}-password`} label="Password" message={tooShort ? "At least 10 characters" : null}>
        <PasswordInput
          id={`${id}-password`}
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setTooShort(false);
          }}
          aria-invalid={tooShort || undefined}
          aria-describedby={tooShort ? `${id}-password-message` : undefined}
          required
        />
      </AuthField>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Create account
      </Button>
    </form>
  );
}
