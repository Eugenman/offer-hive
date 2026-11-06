"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword, type CodeResult } from "@/lib/auth/actions";
import { AuthField } from "./field";
import { openApp } from "./next-path";
import { PasswordInput } from "./password-input";
import { RecoveryCodeScreen } from "./recovery-code-screen";

const MIN_PASSWORD_LENGTH = 10;

export function ResetPasswordForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
    const result = await resetPassword({ email, code, password });
    setPending(false);
    if (result.ok) setIssued(result);
    else if (result.reason === "short_password") setTooShort(true);
    else setError("The email or recovery code is wrong.");
  }

  if (issued) {
    return (
      <RecoveryCodeScreen
        code={issued.code}
        emailed={issued.emailed}
        onContinue={() => {
          openApp("/dashboard");
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
      <AuthField id={`${id}-code`} label="Recovery code">
        <Input
          id={`${id}-code`}
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono uppercase"
          required
        />
      </AuthField>
      <AuthField
        id={`${id}-password`}
        label="New password"
        message={tooShort ? "At least 10 characters" : null}
      >
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
        Reset password
      </Button>
    </form>
  );
}
