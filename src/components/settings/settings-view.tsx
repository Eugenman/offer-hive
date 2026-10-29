"use client";

import { useId, useLayoutEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
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
import { ImportDialog } from "@/components/applications/add/import-dialog";
import { useApplicationActions } from "@/components/applications/use-application-actions";
import { countApplications } from "@/lib/plural";
import { useRepository, useRepositoryQuery } from "@/lib/repository/provider";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-4 border-b pb-8 last:border-0">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Setting({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-md">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const repository = useRepository();
  const actions = useApplicationActions();
  const [confirmClear, setConfirmClear] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Next.js keeps hidden pages alive (<Activity>): close transient dialogs when leaving.
  useLayoutEffect(
    () => () => {
      setConfirmClear(false);
      setImportOpen(false);
    },
    [],
  );
  const { data: total = 0 } = useRepositoryQuery(
    "total",
    async (repo) => (await repo.list({ pageSize: 1 })).total,
  );

  async function clearAll() {
    try {
      await repository.clear();
      toast.success("All data deleted");
    } catch {
      toast.error("Couldn’t delete the data");
    }
  }

  return (
    <div className="grid max-w-3xl gap-8 px-6 py-6">
      <Section title="Data">
        <Setting
          title="Export"
          description="All applications in one spreadsheet. Opens in Excel, Numbers and LibreOffice."
        >
          <Button
            variant="outline"
            disabled={total === 0}
            onClick={() => void actions.exportCsv({ query: {} })}
          >
            <Download aria-hidden />
            Download spreadsheet
          </Button>
        </Setting>
        <Setting title="Import" description="Upload the spreadsheet you kept your applications in.">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload aria-hidden />
            Import spreadsheet
          </Button>
        </Setting>
        <Setting
          title="Delete all data"
          description={`Applications, progress, notes and status history: ${countApplications(total)} now.`}
        >
          <Button variant="destructive" disabled={total === 0} onClick={() => setConfirmClear(true)}>
            <Trash2 aria-hidden />
            Delete all
          </Button>
        </Setting>
      </Section>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all data?</AlertDialogTitle>
            <AlertDialogDescription>
              Every application and everything attached to it will be deleted. This can’t be undone. Download
              the spreadsheet first if you may need the data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void clearAll()}>
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
