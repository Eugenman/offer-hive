import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Application } from "@/lib/domain";
import { formatDate, formatSalary } from "@/lib/format";
import { CompanyAvatar } from "./company-avatar";
import { RowActions } from "./row-actions";
import { StatusBadge } from "./status-badge";

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

const EMPTY = <span className="text-muted-foreground/60">—</span>;

function NoteCell({ notes }: { notes: Application["notes"] }) {
  if (notes.length === 0) return EMPTY;
  const [latest] = notes;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex max-w-full items-center gap-1.5 rounded-md text-left text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <MessageSquareText className="size-3.5 shrink-0" aria-hidden />
          <span className="text-xs tabular-nums">{notes.length}</span>
          <span className="truncate">{latest.body}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-80">
        {latest.body}
      </TooltipContent>
    </Tooltip>
  );
}

export function ApplicationsTable({ applications }: { applications: Application[] }) {
  return (
    <Table className="min-w-[1000px] table-fixed">
      <colgroup>
        <col className="w-14" />
        <col className="w-72" />
        <col className="w-32" />
        <col className="w-32" />
        <col className="w-48" />
        <col className="w-36" />
        <col />
        <col className="w-16" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-6">
            <Checkbox aria-label="Выбрать все отклики на странице" />
          </TableHead>
          <TableHead>Компания и должность</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата отклика</TableHead>
          <TableHead>Зарплата</TableHead>
          <TableHead>Источник</TableHead>
          <TableHead>Заметки</TableHead>
          <TableHead className="pr-6">
            <span className="sr-only">Действия</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow key={app.id} data-id={app.id}>
            <TableCell className="pl-6">
              <Checkbox aria-label={`Выбрать: ${app.company}`} />
            </TableCell>
            <TableCell>
              <Link
                href={`/applications/${app.id}`}
                className="group flex min-w-0 items-center gap-3 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <CompanyAvatar name={app.company} />
                <span className="min-w-0">
                  <span className="block truncate font-medium group-hover:underline">
                    {app.company}
                  </span>
                  <span className="block truncate text-muted-foreground">{app.position}</span>
                </span>
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={app.status} />
            </TableCell>
            <TableCell>{formatDate(app.appliedAt) ?? EMPTY}</TableCell>
            <TableCell className="truncate tabular-nums">
              {formatSalary(app.salaryMin, app.salaryMax, app.currency) ?? EMPTY}
            </TableCell>
            <TableCell className="truncate">
              {app.source ? <Muted>{app.source}</Muted> : EMPTY}
            </TableCell>
            <TableCell className="max-w-0">
              <NoteCell notes={app.notes} />
            </TableCell>
            <TableCell className="pr-6 text-right">
              <RowActions id={app.id} company={app.company} status={app.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
