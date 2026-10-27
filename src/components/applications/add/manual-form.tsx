"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES, STATUS_LABELS, WORK_FORMATS, WORK_FORMAT_LABELS } from "@/lib/domain";
import { useRepository } from "@/lib/repository/provider";
import { applicationInputSchema } from "@/lib/schemas";
import { Field } from "./form-field";

type FormField =
  | "company" | "position" | "status" | "appliedAt" | "url" | "salaryMin" | "salaryMax" | "currency"
  | "workFormat" | "location" | "contactName" | "contactInfo" | "source" | "note";
type Values = Record<FormField, string>;
type Errors = Partial<Record<FormField, string>>;

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in the user's time zone

const initialValues = (): Values => ({
  company: "", position: "", status: "sent", appliedAt: today(), url: "", salaryMin: "", salaryMax: "",
  currency: "", workFormat: "", location: "", contactName: "", contactInfo: "", source: "", note: "",
});

// Native <select> keeps label, keyboard and mobile pickers working out of the box.
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

function parseAmount(value: string): number | null | "invalid" {
  const digits = value.replace(/[\s ]/g, "");
  if (!digits) return null;
  return /^\d+$/.test(digits) ? Number(digits) : "invalid";
}

export function ManualForm({ onDone }: { onDone: () => void }) {
  const repository = useRepository();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const bind = (field: FormField) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      // "From > to" is reported on one field but fixed by editing either.
      const linked: FormField[] = field === "salaryMin" || field === "salaryMax" ? ["salaryMin", "salaryMax"] : [field];
      if (linked.some((name) => errors[name])) {
        setErrors((current) => ({ ...current, ...Object.fromEntries(linked.map((name) => [name, undefined])) }));
      }
    },
  });

  function focusFirstError() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    const salaryMin = parseAmount(values.salaryMin);
    const salaryMax = parseAmount(values.salaryMax);
    if (salaryMin === "invalid") next.salaryMin = "Только число";
    if (salaryMax === "invalid") next.salaryMax = "Только число";

    const parsed = applicationInputSchema.safeParse({
      company: values.company,
      position: values.position,
      status: values.status,
      appliedAt: values.appliedAt || null,
      url: values.url,
      salaryMin: salaryMin === "invalid" ? null : salaryMin,
      salaryMax: salaryMax === "invalid" ? null : salaryMax,
      currency: values.currency,
      workFormat: values.workFormat || null,
      location: values.location,
      contactName: values.contactName,
      contactInfo: values.contactInfo,
      source: values.source,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FormField;
        next[field] ??= issue.message;
      }
    }
    if (Object.keys(next).length > 0 || !parsed.success) {
      setErrors(next);
      // Optional fields with errors live in the collapsed section — open it.
      if (Object.keys(next).some((field) => !["company", "position", "status"].includes(field))) setMore(true);
      focusFirstError();
      return;
    }

    setSaving(true);
    try {
      const app = await repository.create(parsed.data);
      if (values.note.trim()) await repository.addNote(app.id, { body: values.note });
      toast.success(`Отклик «${app.company}» добавлен`, {
        action: { label: "Открыть", onClick: () => router.push(`/applications/${app.id}`) },
      });
      setValues(initialValues());
      onDone();
    } catch {
      toast.error("Не удалось добавить отклик");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Компания" required error={errors.company}>
        <Input {...bind("company")} autoComplete="organization" placeholder="Северный Ветер" autoFocus />
      </Field>
      <Field label="Должность" required error={errors.position}>
        <Input {...bind("position")} autoComplete="organization-title" placeholder="Frontend-разработчик" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Статус">
          <select {...bind("status")} className={selectClass}>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата отклика" error={errors.appliedAt}>
          <Input {...bind("appliedAt")} type="date" />
        </Field>
      </div>

      <button
        type="button"
        onClick={() => setMore((open) => !open)}
        aria-expanded={more}
        aria-controls="add-more-fields"
        className="-mx-1 flex w-fit items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronDown className={cn("size-4 transition-transform", !more && "-rotate-90")} aria-hidden />
        Ещё поля: ссылка, зарплата, контакт, заметка
      </button>

      <div id="add-more-fields" hidden={!more} className="grid gap-4">
        <Field label="Ссылка на вакансию" error={errors.url}>
          <Input {...bind("url")} type="url" inputMode="url" placeholder="https://example.com/jobs/123" />
        </Field>
        <div className="grid grid-cols-[1fr_1fr_5.5rem] gap-3">
          <Field label="Зарплата от" error={errors.salaryMin}>
            <Input {...bind("salaryMin")} inputMode="numeric" placeholder="200 000" />
          </Field>
          <Field label="до" error={errors.salaryMax}>
            <Input {...bind("salaryMax")} inputMode="numeric" placeholder="250 000" />
          </Field>
          <Field label="Валюта" error={errors.currency}>
            <Input {...bind("currency")} maxLength={5} placeholder="RUB" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Формат">
            <select {...bind("workFormat")} className={selectClass}>
              <option value="">Не указан</option>
              {WORK_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {WORK_FORMAT_LABELS[format]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Город" error={errors.location}>
            <Input {...bind("location")} placeholder="Москва" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Контакт" error={errors.contactName}>
            <Input {...bind("contactName")} placeholder="Имя рекрутера" />
          </Field>
          <Field label="Email или Telegram" error={errors.contactInfo}>
            <Input {...bind("contactInfo")} placeholder="name@example.com" />
          </Field>
        </div>
        <Field label="Источник" error={errors.source} hint="Где нашли вакансию">
          <Input {...bind("source")} placeholder="hh.ru" />
        </Field>
        <Field label="Заметка">
          <Textarea {...bind("note")} rows={3} placeholder="Что важно запомнить" />
        </Field>
      </div>

      <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" disabled={saving}>
          Добавить
        </Button>
      </div>
    </form>
  );
}
