"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { AuthField } from "@/components/auth/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAccount } from "@/lib/auth/actions";
import { discardUnsentChanges } from "@/lib/repository/provider";
import { Setting } from "./section";

/** The last setting of Account: deletes the account and all its data, after the current password. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <Setting
      danger
      title="Delete account"
      description="Your account and all your applications, notes and statistics are deleted for good."
    >
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          {/* A new form each time the dialog opens: no password left from the last time. */}
          {open ? <DeleteAccountForm onCancel={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </Setting>
  );
}

function DeleteAccountForm({ onCancel }: { onCancel: () => void }) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await deleteAccount({ password }).catch(() => ({ ok: false, reason: "failed" }) as const);
    if (result.ok) {
      // Changes still waiting in this browser belong to an account that no longer exists.
      await discardUnsentChanges().catch(() => {});
      // A full page load: nothing of the deleted account stays in this tab's memory.
      window.location.replace(new URL("/login", window.location.href));
      return;
    }
    setPending(false);
    if (result.reason === "wrong_password") setWrong(true);
    else if (result.reason === "signed_out") setError("You’re signed out. Sign in again.");
    else setError("Couldn’t delete the account. Try again.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogDescription>
          Your account and all your data are deleted for good. This can’t be undone. Download a backup first
          if you may need the data.
        </DialogDescription>
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={pending || password === ""}>
          Delete account
        </Button>
      </DialogFooter>
    </form>
  );
}
