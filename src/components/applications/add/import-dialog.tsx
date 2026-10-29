"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportWizard } from "./import-wizard";

/**
 * The import wizard on its own, opened in place (e.g. from Settings): no navigation, conflicts are
 * resolved inside the dialog, and the report offers "Open applications".
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [inProgress, setInProgress] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Remounts the wizard after closing, so it starts from the first step next time.
  const [session, setSession] = useState(0);

  function close() {
    setInProgress(false);
    setConfirmClose(false);
    setSession((n) => n + 1);
    onOpenChange(false);
  }

  // Next.js keeps hidden pages alive (<Activity>): don't leave the dialog open for the next visit.
  useLayoutEffect(() => () => setConfirmClose(false), []);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else if (inProgress) setConfirmClose(true);
          else close();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import spreadsheet</DialogTitle>
            <DialogDescription className="sr-only">Import applications from a spreadsheet</DialogDescription>
          </DialogHeader>
          <ImportWizard
            key={session}
            onDone={close}
            onProgressChange={setInProgress}
            onOpenList={() => {
              close();
              router.push("/dashboard");
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop the import?</AlertDialogTitle>
            <AlertDialogDescription>Nothing will be saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue import</AlertDialogCancel>
            <AlertDialogAction onClick={close}>Stop</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
