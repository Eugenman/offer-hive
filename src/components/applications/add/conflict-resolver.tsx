"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, WORK_FORMAT_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { IMPORT_FIELD_LABELS } from "@/lib/import/fields";
import { type ComparableField, type Conflict, type ConflictChoice, mergeConflicts } from "@/lib/import/match";

const FIELD_LABELS: Record<ComparableField, string> = {
  company: IMPORT_FIELD_LABELS.company,
  position: IMPORT_FIELD_LABELS.position,
  status: IMPORT_FIELD_LABELS.status,
  appliedAt: IMPORT_FIELD_LABELS.appliedAt,
  url: IMPORT_FIELD_LABELS.url,
  salaryMin: IMPORT_FIELD_LABELS.salaryMin,
  salaryMax: IMPORT_FIELD_LABELS.salaryMax,
  currency: IMPORT_FIELD_LABELS.currency,
  workFormat: IMPORT_FIELD_LABELS.workFormat,
  location: IMPORT_FIELD_LABELS.location,
  contactName: IMPORT_FIELD_LABELS.contactName,
  contactInfo: IMPORT_FIELD_LABELS.contactInfo,
  source: IMPORT_FIELD_LABELS.source,
};

function display(field: ComparableField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "status") return STATUS_LABELS[value as keyof typeof STATUS_LABELS];
  if (field === "workFormat") return WORK_FORMAT_LABELS[value as keyof typeof WORK_FORMAT_LABELS];
  if (field === "appliedAt") return formatDate(value as string) ?? String(value);
  if (field === "salaryMin" || field === "salaryMax")
    return new Intl.NumberFormat("ru-RU").format(value as number);
  return String(value);
}

type Side = "existing" | "incoming";

function Card({
  side,
  conflict,
  merging,
  picks,
  onPick,
}: {
  side: Side;
  conflict: Conflict;
  merging: ComparableField[] | null;
  picks: Partial<Record<ComparableField, Side>>;
  onPick: (field: ComparableField) => void;
}) {
  const source = side === "existing" ? conflict.existing : conflict.incoming;
  const note = side === "incoming" ? conflict.incoming.notes : null;
  return (
    <div className="min-w-0 overflow-hidden rounded-lg ring-1 ring-border">
      <div className="bg-muted/60 px-3 py-2 text-sm font-medium">
        {side === "existing" ? "Старый вариант" : "Новый вариант"}
      </div>
      <div role={merging ? "radiogroup" : undefined} aria-label={merging ? "Выбор значений" : undefined}>
        {conflict.fields.map((field) => {
          const changed = conflict.changed.includes(field);
          const pickable = merging?.includes(field) ?? false;
          const selected = pickable && (picks[field] ?? "existing") === side;
          const content = (
            <>
              <span className="block text-xs text-muted-foreground">{FIELD_LABELS[field]}</span>
              <span className="block break-words">{display(field, source[field])}</span>
            </>
          );
          const className = cn(
            "block w-full border-t px-3 py-1.5 text-left",
            changed && "bg-amber-50 dark:bg-amber-950/40",
            selected && "bg-primary/10 shadow-[inset_3px_0_0_var(--primary)] dark:bg-primary/20",
          );
          return pickable ? (
            <button
              key={field}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPick(field)}
              className={cn(
                className,
                "hover:ring-1 hover:ring-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              )}
            >
              {content}
            </button>
          ) : (
            <div key={field} className={className}>
              {content}
            </div>
          );
        })}
        <div className={cn("border-t px-3 py-1.5", note && "bg-amber-50 dark:bg-amber-950/40")}>
          <span className="block text-xs text-muted-foreground">Заметки</span>
          <span className="block break-words">{side === "existing" ? "Сохраняются" : (note ?? "—")}</span>
        </div>
      </div>
    </div>
  );
}

type ConflictResolverProps = {
  conflicts: Conflict[];
  onResolved: (decisions: { conflict: Conflict; choice: ConflictChoice }[]) => void;
};

/** "Такой отклик уже есть": the user decides every match, one by one. */
export function ConflictResolver({ conflicts, onResolved }: ConflictResolverProps) {
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<{ conflict: Conflict; choice: ConflictChoice }[]>([]);
  const [applyToRest, setApplyToRest] = useState(false);
  const [merging, setMerging] = useState<ComparableField[] | null>(null);
  const [picks, setPicks] = useState<Partial<Record<ComparableField, Side>>>({});
  const applyToRestId = useId();

  const conflict = conflicts[index];
  const rest = conflicts.length - index - 1;

  function finish(nextDecisions: typeof decisions, nextIndex: number) {
    setMerging(null);
    setPicks({});
    if (nextIndex >= conflicts.length) onResolved(nextDecisions);
    else {
      setDecisions(nextDecisions);
      setIndex(nextIndex);
    }
  }

  function decide(choice: ConflictChoice) {
    let next = [...decisions, { conflict, choice }];
    let nextIndex = index + 1;
    if (applyToRest) {
      while (nextIndex < conflicts.length) {
        const upcoming = conflicts[nextIndex];
        // A merge that needs field picks stops at that record.
        if (choice.kind === "merge" && mergeConflicts(upcoming).length > 0) break;
        next = [
          ...next,
          { conflict: upcoming, choice: choice.kind === "merge" ? { kind: "merge", picks: {} } : choice },
        ];
        nextIndex += 1;
      }
    }
    finish(next, nextIndex);
  }

  function acceptBoth() {
    const fields = mergeConflicts(conflict);
    if (fields.length === 0) decide({ kind: "merge", picks: {} });
    else setMerging(fields);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline gap-2">
        <h3 className="flex-1 text-base font-semibold">Такой отклик уже есть</h3>
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} из {conflicts.length}
        </span>
      </div>
      {merging ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          В этих полях разные значения — выберите, какое оставить. Остальное объединится, заметки сохранятся
          из обоих вариантов.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {(["existing", "incoming"] as const).map((side) => (
          <div key={side} className="flex min-w-0 flex-col gap-2">
            <Card
              side={side}
              conflict={conflict}
              merging={merging}
              picks={picks}
              onPick={(field) => setPicks((current) => ({ ...current, [field]: side }))}
            />
            {merging ? null : (
              <Button variant="outline" onClick={() => decide({ kind: side })}>
                Принять вариант
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="-mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-b-xl border-t bg-muted/50 p-4">
        {merging ? (
          <>
            <span className="flex-1" />
            <Button variant="outline" onClick={() => setMerging(null)}>
              Назад
            </Button>
            <Button
              onClick={() =>
                decide({
                  kind: "merge",
                  picks: Object.fromEntries(merging.map((f) => [f, picks[f] ?? "existing"])),
                })
              }
            >
              Сохранить
            </Button>
          </>
        ) : (
          <>
            <div className={cn("flex flex-1 items-center gap-2", rest === 0 && "invisible")}>
              <Checkbox
                id={applyToRestId}
                checked={applyToRest}
                onCheckedChange={(v) => setApplyToRest(v === true)}
              />
              <Label htmlFor={applyToRestId} className="font-normal">
                Сделать так же для остальных ({rest})
              </Label>
            </div>
            <Button onClick={acceptBoth}>Принять оба</Button>
          </>
        )}
      </div>
    </div>
  );
}
