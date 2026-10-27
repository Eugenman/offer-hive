"use client";

import { useState } from "react";
import { CircleCheck, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildApplicationsCsv, downloadFile } from "@/lib/export/applications-csv";
import { applyImport, type ImportResult } from "@/lib/import/apply";
import { DEMO_TABLE } from "@/lib/import/demo-table";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  type ImportField,
  REQUIRED_IMPORT_FIELDS,
  autoMap,
} from "@/lib/import/fields";
import { type ImportPlan, planImport } from "@/lib/import/match";
import { normalizeRow, type RowResult } from "@/lib/import/normalize";
import { APPLICATION_WORDS, pluralRu } from "@/lib/plural";
import { useRepository } from "@/lib/repository/provider";
import { ConflictResolver } from "./conflict-resolver";

const ACCEPT = ".xlsx,.xls,.xlsb,.ods,.fods,.numbers,.csv,.tsv,.txt";

type Step =
  | { name: "file" }
  | { name: "mapping"; fileName: string; mapping: (ImportField | null)[] }
  | { name: "conflicts"; plan: ImportPlan; invalid: RowResult[] }
  | { name: "report"; result: ImportResult; unchanged: number; invalid: RowResult[] };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

const count = (n: number) => `${n} ${pluralRu(n, APPLICATION_WORDS)}`;

export function ImportWizard({
  onDone,
  onProgressChange,
}: {
  onDone: () => void;
  /** True while there is something to lose on close (after a file is chosen, before writing). */
  onProgressChange: (inProgress: boolean) => void;
}) {
  const repository = useRepository();
  const [step, setStepState] = useState<Step>({ name: "file" });
  const [dragging, setDragging] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  function setStep(next: Step) {
    setStepState(next);
    onProgressChange(next.name === "mapping" || next.name === "conflicts");
  }

  // Stage 1: any chosen file is replaced by a demo table; SheetJS parsing arrives in stage 3.
  function chooseFile(file: File | undefined) {
    if (!file) return;
    setMappingError(null);
    setStep({ name: "mapping", fileName: file.name, mapping: autoMap(DEMO_TABLE.headers) });
  }

  function downloadTemplate() {
    downloadFile(buildApplicationsCsv([]), "offerhive-template.csv", "text/csv;charset=utf-8");
  }

  async function finish(plan: ImportPlan, decisions: Parameters<typeof applyImport>[2], invalid: RowResult[]) {
    try {
      const result = await applyImport(repository, plan.toCreate, decisions);
      setStep({ name: "report", result, unchanged: plan.unchanged.length, invalid });
    } catch {
      toast.error("Не удалось импортировать таблицу");
    }
  }

  async function confirmMapping(mapping: (ImportField | null)[]) {
    const missing = REQUIRED_IMPORT_FIELDS.filter((field) => !mapping.includes(field));
    if (missing.length > 0) {
      setMappingError(`Выберите колонку для поля: ${missing.map((f) => IMPORT_FIELD_LABELS[f]).join(", ")}`);
      return;
    }
    const used = mapping.filter((field): field is ImportField => field !== null);
    const duplicate = used.find((field, index) => used.indexOf(field) !== index);
    if (duplicate) {
      setMappingError(`Поле «${IMPORT_FIELD_LABELS[duplicate]}» выбрано для нескольких колонок`);
      return;
    }
    const rows = DEMO_TABLE.rows.map((cells, index) => normalizeRow(cells, mapping, index + 2));
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
            chooseFile(event.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            dragging && "border-primary bg-muted/60",
          )}
        >
          <Upload className="size-6 text-muted-foreground" aria-hidden />
          <span className="font-medium">Перетащите файл сюда или выберите на компьютере</span>
          <span className="text-xs text-muted-foreground">
            Excel, LibreOffice, Numbers, CSV. Файл обрабатывается в браузере и никуда не отправляется.
          </span>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Начинаете с нуля?{" "}
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            Скачайте шаблон таблицы
          </button>
        </p>
      </div>
    );
  }

  if (step.name === "mapping") {
    const { mapping, fileName } = step;
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
          <span className="text-muted-foreground">· {count(DEMO_TABLE.rows.length)}</span>
        </div>
        <p className="-mt-2 text-sm text-muted-foreground">
          Проверьте, какие колонки куда попадут. Что распознано автоматически, уже выбрано.
        </p>
        <div className="max-h-[50vh] overflow-auto rounded-lg ring-1 ring-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Колонка в файле</th>
                <th className="px-3 py-2 font-medium">Пример значения</th>
                <th className="w-56 px-3 py-2 font-medium">Поле в Offerhive</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_TABLE.headers.map((header, index) => {
                const sample = DEMO_TABLE.rows.map((row) => row[index]).find(Boolean) ?? "—";
                return (
                  <tr key={header} className="border-t">
                    <td className="px-3 py-2 font-medium">{header}</td>
                    <td className="max-w-48 truncate px-3 py-2 text-muted-foreground">{sample}</td>
                    <td className="px-3 py-1.5">
                      <select
                        value={mapping[index] ?? ""}
                        onChange={(event) => setField(index, event.target.value)}
                        aria-label={`Поле для колонки «${header}»`}
                        className={cn(selectClass, !mapping[index] && "text-muted-foreground")}
                      >
                        <option value="">Не импортировать</option>
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
            Другой файл
          </Button>
          <Button onClick={() => void confirmMapping(mapping)}>Продолжить</Button>
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
    { label: "Добавлено", value: result.created },
    { label: "Обновлено", value: result.updated },
    { label: "Оставлено как было", value: result.kept },
    { label: "Без изменений, пропущено", value: unchanged },
    { label: "Не импортировано из-за ошибок", value: invalid.length },
  ].filter((line) => line.value > 0);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <CircleCheck className="size-5 text-status-offer" aria-hidden />
        <h3 className="text-base font-semibold">Импорт завершён</h3>
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
          <p className="mb-1 font-medium">Строки с ошибками</p>
          <ul className="grid gap-0.5 text-muted-foreground">
            {invalid.map((row) =>
              row.ok ? null : (
                <li key={row.row}>
                  Строка {row.row}: {row.reason}
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
      <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
        <Button onClick={onDone}>Готово</Button>
      </div>
    </div>
  );
}
