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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ImportWizard } from "./import-wizard";
import { ManualForm } from "./manual-form";
import { type AddTab, useAddDialog } from "./use-add-dialog";

export function AddApplicationDialog() {
  const dialog = useAddDialog();
  const [importInProgress, setImportInProgress] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Remounts the import wizard after it was closed, so it starts from the first step.
  const [importSession, setImportSession] = useState(0);

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
          className={cn("max-h-[calc(100vh-2rem)] overflow-y-auto", dialog.tab === "import" ? "sm:max-w-3xl" : "sm:max-w-lg")}
        >
          <DialogHeader>
            <DialogTitle>Новый отклик</DialogTitle>
            <DialogDescription className="sr-only">
              Добавьте отклик вручную или загрузите таблицу с откликами
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={dialog.tab ?? "manual"}
            onValueChange={(value) => {
              if (dialog.tab === "import" && importInProgress) return;
              dialog.switchTo(value as AddTab);
            }}
          >
            <TabsList>
              <TabsTrigger value="manual" disabled={importInProgress}>
                Вручную
              </TabsTrigger>
              <TabsTrigger value="import">Импорт таблицы</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-3">
              <ManualForm onDone={close} />
            </TabsContent>
            <TabsContent value="import" className="pt-3">
              <ImportWizard key={importSession} onDone={close} onProgressChange={setImportInProgress} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Прервать импорт?</AlertDialogTitle>
            <AlertDialogDescription>Ничего не будет записано.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить импорт</AlertDialogCancel>
            <AlertDialogAction onClick={close}>Прервать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
