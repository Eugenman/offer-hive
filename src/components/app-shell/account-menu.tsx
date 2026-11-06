"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import { countUnsentChanges } from "@/lib/repository/provider";

const ROW =
  "mt-2 flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left sidebar-collapsed:justify-center";

/** The signed-in account at the bottom of the sidebar, with sign-out. */
export function AccountMenu({ email }: { email: string }) {
  const [signingOut, setSigningOut] = useState(false);
  const [confirmUnsent, setConfirmUnsent] = useState(false);

  /** Changes still waiting for the server stay in this browser; warn before leaving them there. */
  async function requestSignOut() {
    if ((await countUnsentChanges().catch(() => 0)) > 0) setConfirmUnsent(true);
    else await signOut();
  }

  async function signOut() {
    setSigningOut(true);
    const { error } = await authClient.signOut().catch(() => ({ error: true }));
    if (error) {
      setSigningOut(false);
      toast.error("Couldn’t sign out. Try again.");
      return;
    }
    // A full page load, not client navigation: this tab's data must not outlive the session.
    window.location.replace(new URL("/login", window.location.href));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${ROW} transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-background`}
          aria-label={`Account: ${email}`}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium uppercase ring-1 ring-border"
            aria-hidden
          >
            {email.charAt(0)}
          </span>
          <span className="min-w-0 sidebar-collapsed:sr-only">
            <span className="block truncate text-sm font-medium">{email}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onSelect={() => void requestSignOut()}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmUnsent} onOpenChange={setConfirmUnsent}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some changes aren’t saved yet</AlertDialogTitle>
            <AlertDialogDescription>
              They’ll be saved the next time you sign in on this browser. Sign out anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void signOut()}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Same size as the account row, while the session is read. */
export function AccountPlaceholder() {
  return (
    <div className={ROW} aria-hidden>
      <span className="size-8 shrink-0 rounded-full bg-background ring-1 ring-border" />
      <span className="h-3 w-32 rounded bg-background sidebar-collapsed:hidden" />
    </div>
  );
}
