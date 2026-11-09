"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { plural } from "@/lib/plural";
import { useRepository } from "@/lib/repository/provider";
import type { ArchivedApplicationDetails } from "@/lib/repository/types";
import { ApplicationFields } from "../applications/detail/application-fields";
import { ApplicationHeader } from "../applications/detail/application-header";
import { InlineEditingProvider } from "../applications/detail/inline-field";
import { StagesSection } from "../applications/detail/stages-section";
import { NotesCard } from "../applications/detail/notes-card";

const DAY_MS = 86_400_000;

/**
 * An archived application, read-only: the same cards as the live page, but nothing can be edited
 * until it is restored. "Delete forever" erases it right away.
 */
export function ArchivedApplication({ app, now }: { app: ArchivedApplicationDetails; now: number }) {
  const router = useRouter();
  const repository = useRepository();
  const [confirmErase, setConfirmErase] = useState(false);
  const daysLeft = Math.max(1, Math.ceil((Date.parse(app.erasedAt) - now) / DAY_MS));

  // Reset transient UI when Next.js hides this page (<Activity>).
  useLayoutEffect(() => () => setConfirmErase(false), []);

  async function restore() {
    try {
      await repository.restore([app.id]);
      toast.success(`Restored ${app.company}`);
      // Back to the Applications list, the same way archiving leaves the live page for the list.
      router.push("/dashboard");
    } catch {
      toast.error("Couldn’t restore");
    }
  }

  async function erase() {
    try {
      await repository.erase([app.id]);
      toast.success(`Deleted ${app.company} forever`);
      router.push("/archive");
    } catch {
      toast.error("Couldn’t delete");
    }
  }

  return (
    <>
      <InlineEditingProvider readOnly>
        <ApplicationHeader
          app={app}
          mode="archived"
          actions={
            <>
              <Button onClick={() => void restore()}>
                <RotateCcw aria-hidden />
                Restore
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setConfirmErase(true)}
                aria-label="Delete forever"
                title="Delete forever"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 aria-hidden />
              </Button>
            </>
          }
        />
        <p
          role="status"
          className="mx-6 mt-6 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
        >
          <Archive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            In the archive since {formatDate(app.deletedAt.slice(0, 10))}. It will be erased in {daysLeft}{" "}
            {plural(daysLeft, "day", "days")}. Restore it to make changes.
          </span>
        </p>

        {/* Read-only: values as plain text, no edit or add controls. */}
        <div className="grid gap-4 px-6 py-6 desktop:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="grid content-start gap-4">
            <ApplicationFields app={app} />
            <NotesCard app={app} />
          </div>
          <StagesSection app={app} />
        </div>
      </InlineEditingProvider>

      <AlertDialog open={confirmErase} onOpenChange={setConfirmErase}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              {app.company} and everything attached to it (progress, notes, status history) will be erased.
              This can’t be undone. Statistics keep counting it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void erase()}>
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
