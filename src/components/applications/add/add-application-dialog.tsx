"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ImportWizard } from "./import-wizard";
import { ManualForm } from "./manual-form";
import { type AddTab, useAddDialog } from "./use-add-dialog";

export function AddApplicationDialog({
  initialFile,
  onFileConsumed,
}: {
  initialFile?: File | null;
  /** Called once the wizard has started reading that file, so it is never re-read. */
  onFileConsumed?: () => void;
} = {}) {
  const dialog = useAddDialog();
  const [importInProgress, setImportInProgress] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Remounts the import wizard after it was closed, so it starts from the first step.
  const [importSession, setImportSession] = useState(0);
  // The URL clears the tab on close; keep the last one so the dialog does not flash the other tab
  // while it fades out. Adjusting state during render is React's documented pattern for this.
  const [lastTab, setLastTab] = useState<AddTab>("manual");
  if (dialog.tab && dialog.tab !== lastTab) setLastTab(dialog.tab);

  function close() {
    setImportInProgress(false);
    setConfirmClose(false);
    setImportSession((n) => n + 1);
    dialog.close();
  }

  function requestClose() {
    if (dialog.tab === "import" && importInProgress) setConfirmClose(true);
    else close();
  }

  return (
    <>
      <Dialog open={dialog.tab !== null} onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          className={cn(
            "max-h-[calc(100vh-2rem)] overflow-y-auto",
            dialog.tab === "import" ? "sm:max-w-3xl" : "sm:max-w-lg",
          )}
        >
          <DialogHeader>
            <DialogTitle>New application</DialogTitle>
            <DialogDescription className="sr-only">
              Add an application by hand or import a spreadsheet
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={dialog.tab ?? lastTab}
            onValueChange={(value) => {
              if (dialog.tab === "import" && importInProgress) return;
              dialog.switchTo(value as AddTab);
            }}
          >
            <TabsList>
              <TabsTrigger value="manual" disabled={importInProgress}>
                Manually
              </TabsTrigger>
              <TabsTrigger value="import">Import spreadsheet</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-3">
              <ManualForm onDone={close} />
            </TabsContent>
            <TabsContent value="import" className="pt-3">
              <ImportWizard
                key={importSession}
                initialFile={initialFile}
                onFileConsumed={onFileConsumed}
                onDone={close}
                onProgressChange={setImportInProgress}
              />
            </TabsContent>
          </Tabs>
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
