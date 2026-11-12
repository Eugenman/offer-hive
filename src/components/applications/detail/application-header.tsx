"use client";

import { type ReactNode, useLayoutEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { MenuButton } from "@/components/app-shell/nav-menu";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, ChevronDown, Clock } from "lucide-react";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { type ApplicationDetails, STATUS_LABELS, nextStatuses, reopenTargets } from "@/lib/domain";
import { useRepository } from "@/lib/repository/provider";
import { StatusBadge } from "../status-badge";
import { StatusMenuGroups } from "../status-menu-groups";
import { useApplicationActions } from "../use-application-actions";
import { InlineField } from "./inline-field";
import { StatusHistory } from "./status-log";
import { listUrl } from "./return-to-list";
import { trySave } from "./save-error";

const noop = () => () => {};

/**
 * The header of an application page. The archive reuses it: the same title, status and clock,
 * with its own actions and a way back to the archive.
 */
export function ApplicationHeader({
  app,
  mode = "live",
  actions: customActions,
}: {
  app: ApplicationDetails;
  mode?: "live" | "archived";
  /** Replaces the live actions (Change status, archive) — the archive passes Restore and Delete. */
  actions?: ReactNode;
}) {
  const repository = useRepository();
  const actions = useApplicationActions();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const choices = nextStatuses(app.status);
  // A closed process can come back to life, but only on purpose: the button, never a drag.
  const reopenTo = reopenTargets(app.status);
  const closed = reopenTo.length > 0;

  // sessionStorage exists only in the browser; the server renders the plain list URL.
  const listHref = useSyncExternalStore(noop, listUrl, () => "/dashboard");
  const backHref = mode === "archived" ? "/archive" : listHref;
  const backLabel = mode === "archived" ? "Archive" : "Applications";

  // Transient dialogs close when Next.js hides this page (<Activity>), so they are not open on return.
  useLayoutEffect(
    () => () => {
      setConfirmDelete(false);
      setConfirmReopen(false);
    },
    [],
  );

  async function remove() {
    // Back to the list first: the page must not follow the application into the archive.
    router.push(backHref);
    await actions.remove([app.id], app.company);
  }

  /** The company came back: a new process, with the old one left closed for the statistics. */
  async function startNew() {
    setConfirmReopen(false);
    try {
      const copy = await repository.create({
        company: app.company,
        position: app.position,
        status: "sent",
        appliedAt: new Date().toLocaleDateString("sv-SE"),
        url: app.url,
        location: app.location,
        workFormat: app.workFormat,
        salaryMin: app.salaryMin,
        salaryMax: app.salaryMax,
        currency: app.currency,
        contactName: app.contactName,
        contactInfo: app.contactInfo,
        source: app.source,
      });
      toast.success(`Started a new application at ${copy.company}`);
      router.push(`/applications/${copy.id}`);
    } catch {
      toast.error("Couldn’t start a new application");
    }
  }

  /** The same process resumes: the move is logged, the closed one is not deleted. */
  async function continueCurrent() {
    setConfirmReopen(false);
    const target =
      app.previousStatus && reopenTo.includes(app.previousStatus) ? app.previousStatus : reopenTo[0];
    try {
      await repository.reopen(app.id, target);
      toast.success(`Reopened ${app.company}`);
    } catch {
      toast.error("Couldn’t reopen");
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background px-6 pt-4 pb-4 desktop:rounded-t-xl">
      <div className="flex items-center gap-2">
        <MenuButton />
        <Link
          href={backHref}
          className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="-ml-2 text-xl font-semibold">
            <InlineField
              fieldKey="company"
              label="Company"
              value={app.company}
              emptyText="Add company"
              onSave={(value) => trySave(() => repository.update(app.id, { company: value ?? "" }))}
              className="[&_[role=status]]:absolute [&_[role=status]]:top-1/2 [&_[role=status]]:left-full [&_[role=status]]:ml-2 [&_[role=status]]:-translate-y-1/2 [&_button]:relative [&_button]:w-fit [&_button]:text-xl [&_input]:[field-sizing:content] [&_input]:h-8 [&_input]:w-fit [&_input]:border-0 [&_input]:px-2 [&_input]:pr-[1.875rem] [&_input]:text-xl [&_input]:font-semibold [&_input]:ring-1 [&_input]:ring-border"
            />
          </h1>
          <div className="-ml-2 text-muted-foreground">
            <InlineField
              fieldKey="position"
              label="Position"
              value={app.position}
              emptyText="Add position"
              onSave={(value) => trySave(() => repository.update(app.id, { position: value ?? "" }))}
              // The hover area follows the text instead of the whole width of the header.
              className="[&_[role=status]]:absolute [&_[role=status]]:top-1/2 [&_[role=status]]:left-full [&_[role=status]]:ml-2 [&_[role=status]]:-translate-y-1/2 [&_button]:relative [&_button]:w-fit [&_input]:[field-sizing:content] [&_input]:w-fit [&_input]:border-0 [&_input]:px-2 [&_input]:pr-[1.875rem] [&_input]:ring-1 [&_input]:ring-border"
            />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            Status: <StatusBadge status={app.status} />
            {/* The history moved here: an icon, no text, shown on click. */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Status history"
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Clock className="size-4" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto gap-0 p-0">
                <p className="border-b px-3 py-2 text-sm font-semibold">Status history</p>
                <div className="p-3">
                  <StatusHistory app={app} />
                </div>
              </PopoverContent>
            </Popover>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customActions ??
            (choices.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    Change status
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto min-w-0">
                  <StatusMenuGroups
                    statuses={choices}
                    onSelect={(status) => void actions.changeStatus([app.id], status)}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : app.previousStatus ? (
              <Button
                variant="outline"
                onClick={() => void actions.revertStatus(app.id, app.previousStatus!)}
              >
                Back to {STATUS_LABELS[app.previousStatus]}
              </Button>
            ) : null)}
          {customActions || !closed ? null : (
            <Button variant="outline" onClick={() => setConfirmReopen(true)}>
              Reopen
            </Button>
          )}
          {customActions ? null : (
            <Button
              variant="outline"
              size="icon"
              aria-label="Move to archive"
              title="Move to archive"
              onClick={() => setConfirmDelete(true)}
            >
              <Archive aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen the process?</AlertDialogTitle>
            <AlertDialogDescription>
              A company coming back after a refusal is usually a new process: a different role, another
              recruiter. The old one stays closed and keeps its history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void continueCurrent()}>Continue this one</AlertDialogAction>
            <AlertDialogAction onClick={() => void startNew()}>Start a new one</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to archive?</AlertDialogTitle>
            <AlertDialogDescription>
              {app.company} moves to the archive. You can restore it within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Move to archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
