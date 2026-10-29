"use client";

import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Plus, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ApplicationDetails, STAGE_TYPES, STAGE_TYPE_LABELS } from "@/lib/domain";
import { useRepository } from "@/lib/repository/provider";
import { StatusBadge } from "../status-badge";
import { useApplicationActions } from "../use-application-actions";
import { AddEventDialog, type EventKind } from "./add-event-dialog";
import { InlineField } from "./inline-field";
import { listUrl } from "./return-to-list";
import { trySave } from "./save-error";

const noop = () => () => {};

export function ApplicationHeader({ app }: { app: ApplicationDetails }) {
  const repository = useRepository();
  const actions = useApplicationActions();
  const router = useRouter();
  const [event, setEvent] = useState<EventKind | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // sessionStorage exists only in the browser; the server renders the plain list URL.
  const backHref = useSyncExternalStore(noop, listUrl, () => "/dashboard");

  // Transient dialogs close when Next.js hides this page (<Activity>), so they are not open on return.
  useLayoutEffect(
    () => () => {
      setEvent(null);
      setConfirmDelete(false);
    },
    [],
  );

  async function remove() {
    await actions.remove([app.id], app.company);
    router.push(backHref);
  }

  return (
    <header className="border-b px-6 pt-4 pb-4">
      <Link
        href={backHref}
        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Applications
      </Link>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="-ml-2 text-xl font-semibold">
            <InlineField
              fieldKey="company"
              label="Company"
              value={app.company}
              emptyText="Add company"
              onSave={(value) => trySave(() => repository.update(app.id, { company: value ?? "" }))}
              className="[&_button]:text-xl [&_input]:h-9 [&_input]:text-lg"
            />
          </h1>
          <div className="-ml-2 text-muted-foreground">
            <InlineField
              fieldKey="position"
              label="Position"
              value={app.position}
              emptyText="Add position"
              onSave={(value) => trySave(() => repository.update(app.id, { position: value ?? "" }))}
            />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            Status: <StatusBadge status={app.status} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus aria-hidden />
                Add event
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Progress</DropdownMenuLabel>
              {STAGE_TYPES.map((type) => (
                <DropdownMenuItem key={type} onSelect={() => setEvent({ kind: "stage", type })}>
                  {STAGE_TYPE_LABELS[type]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEvent({ kind: "note" })}>Note</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEvent({ kind: "status" })}>Change status</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            aria-label="Delete application"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      <AddEventDialog app={app} event={event} onClose={() => setEvent(null)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application?</AlertDialogTitle>
            <AlertDialogDescription>{app.company} will be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
