"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { AuthField } from "./field";
import { openApp, safeNext } from "./next-path";
import { PasswordInput } from "./password-input";

export function SignInForm() {
  const params = useSearchParams();
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
    if (error) {
      setError("Wrong email or password.");
      setPending(false);
      return;
    }
    openApp(safeNext(params.get("next")));
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
      <AuthField id={`${id}-password`} label="Password">
        <PasswordInput
          id={`${id}-password`}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </AuthField>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}
