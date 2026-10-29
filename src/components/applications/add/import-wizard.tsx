"use client";

import { useState } from "react";
import { CircleCheck, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildApplicationsCsv, downloadFile } from "@/lib/export/applications-csv";
import { applyImport, type ImportResult } from "@/lib/import/apply";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  type ImportField,
  REQUIRED_IMPORT_FIELDS,
  autoMap,
} from "@/lib/import/fields";
import { type ImportPlan, planImport } from "@/lib/import/match";
import { normalizeRow, type RowResult } from "@/lib/import/normalize";
import { type ParsedTable, readSpreadsheet } from "@/lib/import/read-file";
import { countApplications } from "@/lib/plural";
import { useRepository } from "@/lib/repository/provider";
import { ConflictResolver } from "./conflict-resolver";

const ACCEPT = ".xlsx,.xls,.xlsb,.ods,.fods,.numbers,.csv,.tsv,.txt";

type Step =
  | { name: "file" }
  | { name: "mapping"; fileName: string; table: ParsedTable; mapping: (ImportField | null)[] }
  | { name: "conflicts"; plan: ImportPlan; invalid: RowResult[] }
  | { name: "report"; result: ImportResult; unchanged: number; invalid: RowResult[] };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

const count = countApplications;

const READ_ERRORS = {
  too_large: "This file is larger than 10 MB. Save a copy with only your applications and try again.",
  unreadable: "Couldn’t read this file. Save it as .xlsx or .csv and try again.",
  empty: "No table found in this file. The first row should hold the column names.",
} as const;

export function ImportWizard({
  onDone,
  onProgressChange,
  onOpenList,
}: {
  onDone: () => void;
  /** True while there is something to lose on close (after a file is chosen, before writing). */
  onProgressChange: (inProgress: boolean) => void;
  /** Shown as "Open applications" in the report when the wizard runs outside the applications page. */
  onOpenList?: () => void;
}) {
  const repository = useRepository();
  const [step, setStepState] = useState<Step>({ name: "file" });
  const [dragging, setDragging] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  function setStep(next: Step) {
    setStepState(next);
    onProgressChange(next.name === "mapping" || next.name === "conflicts");
  }

  async function chooseFile(file: File | undefined) {
    if (!file || reading) return;
    setMappingError(null);
    setReadError(null);
    setReading(true);
    const result = await readSpreadsheet(file);
    setReading(false);
    if (!result.ok) {
      setReadError(READ_ERRORS[result.reason]);
      return;
    }
    const { table } = result;
    setStep({ name: "mapping", fileName: file.name, table, mapping: autoMap(table.headers) });
  }

  function downloadTemplate() {
    downloadFile(buildApplicationsCsv([]), "offerhive-template.csv", "text/csv;charset=utf-8");
  }

  async function finish(
    plan: ImportPlan,
    decisions: Parameters<typeof applyImport>[2],
    invalid: RowResult[],
  ) {
    try {
      const result = await applyImport(repository, plan.toCreate, decisions);
      setStep({ name: "report", result, unchanged: plan.unchanged.length, invalid });
    } catch {
      toast.error("Couldn’t import the spreadsheet");
    }
  }

  async function confirmMapping(table: ParsedTable, mapping: (ImportField | null)[]) {
    const missing = REQUIRED_IMPORT_FIELDS.filter((field) => !mapping.includes(field));
    if (missing.length > 0) {
      setMappingError(`Choose a column for: ${missing.map((f) => IMPORT_FIELD_LABELS[f]).join(", ")}`);
      return;
    }
    const used = mapping.filter((field): field is ImportField => field !== null);
    const duplicate = used.find((field, index) => used.indexOf(field) !== index);
    if (duplicate) {
      setMappingError(`${IMPORT_FIELD_LABELS[duplicate]} is chosen for more than one column`);
      return;
    }
    const rows = table.rows.map((cells, index) => normalizeRow(cells, mapping, table.rowNumbers[index]));
    const valid = rows.filter((row): row is Extract<RowResult, { ok: true }> => row.ok);
    const invalid = rows.filter((row) => !row.ok);
    const existing = (await repository.list({ pageSize: 100_000 })).items;
    const plan = planImport(valid, existing);
    if (plan.conflicts.length > 0) setStep({ name: "conflicts", plan, invalid });
    else await finish(plan, [], invalid);
  }

  if (step.name === "file") {
    return (
      <div className="grid gap-4">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void chooseFile(event.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            dragging && "border-primary bg-muted/60",
          )}
        >
          {reading ? (
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Upload className="size-6 text-muted-foreground" aria-hidden />
          )}
          <span className="font-medium" aria-live="polite">
            {reading ? "Reading the file…" : "Drop a file here or choose one from your computer"}
          </span>
          <span className="text-xs text-muted-foreground">
            Excel, LibreOffice, Numbers, CSV. The file is read in your browser and never uploaded.
          </span>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={reading}
            onChange={(event) => {
              void chooseFile(event.target.files?.[0]);
              // The same file can be picked again after fixing it.
              event.target.value = "";
            }}
          />
        </label>
        {readError ? (
          <p role="alert" className="text-sm text-destructive">
            {readError}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Starting from scratch?{" "}
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            Download the template
          </button>
        </p>
      </div>
    );
  }

  if (step.name === "mapping") {
    const { mapping, fileName, table } = step;
    const setField = (index: number, value: string) => {
      setMappingError(null);
      const next = [...mapping];
      next[index] = value ? (value as ImportField) : null;
      setStep({ ...step, mapping: next });
    };
    return (
      <div className="grid gap-4">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">{fileName}</span>
          <span className="text-muted-foreground">
            · {table.sheetName ? `${table.sheetName} · ` : ""}
            {count(table.rows.length)}
          </span>
        </div>
        <p className="-mt-2 text-sm text-muted-foreground">
          Check where each column goes. Columns recognized automatically are already set.
        </p>
        <div className="max-h-[50vh] overflow-auto rounded-lg ring-1 ring-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Column in the file</th>
                <th className="px-3 py-2 font-medium">Sample value</th>
                <th className="w-56 px-3 py-2 font-medium">Field in Offerhive</th>
              </tr>
            </thead>
            <tbody>
              {table.headers.map((header, index) => {
                const sample = table.rows.map((row) => row[index]).find(Boolean) ?? "—";
                return (
                  <tr key={`${index}-${header}`} className="border-t">
                    <td className="px-3 py-2 font-medium">{header}</td>
                    <td className="max-w-48 truncate px-3 py-2 text-muted-foreground">{sample}</td>
                    <td className="px-3 py-1.5">
                      <select
                        value={mapping[index] ?? ""}
                        onChange={(event) => setField(index, event.target.value)}
                        aria-label={`Field for column ${header}`}
                        className={cn(selectClass, !mapping[index] && "text-muted-foreground")}
                      >
                        <option value="">Don’t import</option>
                        {IMPORT_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {IMPORT_FIELD_LABELS[field]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {mappingError ? (
          <p role="alert" className="text-sm text-destructive">
            {mappingError}
          </p>
        ) : null}
        <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
          <Button variant="outline" onClick={() => setStep({ name: "file" })}>
            Another file
          </Button>
          <Button onClick={() => void confirmMapping(table, mapping)}>Continue</Button>
        </div>
      </div>
    );
  }

  if (step.name === "conflicts") {
    const { plan, invalid } = step;
    return (
      <ConflictResolver
        conflicts={plan.conflicts}
        onResolved={(decisions) => void finish(plan, decisions, invalid)}
      />
    );
  }

  const { result, unchanged, invalid } = step;
  const lines = [
    { label: "Added", value: result.created },
    { label: "Updated", value: result.updated },
    { label: "Kept as is", value: result.kept },
    { label: "Unchanged, skipped", value: unchanged },
    { label: "Not imported because of errors", value: invalid.length },
  ].filter((line) => line.value > 0);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <CircleCheck className="size-5 text-status-offer" aria-hidden />
        <h3 className="text-base font-semibold">Import finished</h3>
      </div>
      <dl className="grid gap-1 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4 border-b py-1.5 last:border-0">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="font-medium tabular-nums">{count(line.value)}</dd>
          </div>
        ))}
      </dl>
      {invalid.length > 0 ? (
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="mb-1 font-medium">Rows with errors</p>
          <ul className="grid gap-0.5 text-muted-foreground">
            {invalid.map((row) =>
              row.ok ? null : (
                <li key={row.row}>
                  Row {row.row}: {row.reason}
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
      <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
        {onOpenList ? (
          <Button variant="outline" onClick={onOpenList}>
            Open applications
          </Button>
        ) : null}
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
