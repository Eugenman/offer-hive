"use client";

import { useId } from "react";
import { type ApplicationDetails, WORK_FORMATS, WORK_FORMAT_LABELS } from "@/lib/domain";
import { formatDate, formatSalary } from "@/lib/format";
import { useRepository } from "@/lib/repository/provider";
import type { ApplicationPatch } from "@/lib/schemas";
import { InlineField, InlineGroupField } from "./inline-field";
import { trySave } from "./save-error";

function parseAmount(value: string): number | null | "invalid" {
  const digits = value.replace(/[\s ]/g, "");
  if (!digits) return null;
  return /^\d+$/.test(digits) ? Number(digits) : "invalid";
}

/** mailto: for emails, t.me for @handles — otherwise no link. */
export function contactHref(info: string | null) {
  if (!info) return null;
  if (/^\S+@\S+\.\S+$/.test(info)) return `mailto:${info}`;
  const handle = info.match(/^@([A-Za-z0-9_]{5,32})$/)?.[1];
  return handle ? `https://t.me/${handle}` : null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-start gap-2 border-b py-1 last:border-0">
      <dt className="pt-1.5 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function ApplicationFields({ app }: { app: ApplicationDetails }) {
  const repository = useRepository();
  const titleId = useId();
  const update = (patch: ApplicationPatch) => trySave(() => repository.update(app.id, patch));

  const salary = formatSalary(app.salaryMin, app.salaryMax, app.currency);
  const contact = [app.contactName, app.contactInfo].filter(Boolean).join(" · ") || null;

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-2 text-sm font-semibold">
        Данные отклика
      </h2>
      <dl>
        <Row label="Дата отклика">
          <InlineField
            fieldKey="appliedAt"
            label="Дата отклика"
            kind="date"
            value={app.appliedAt}
            display={formatDate(app.appliedAt)}
            emptyText="Добавить дату"
            onSave={(value) => update({ appliedAt: value })}
          />
        </Row>
        <Row label="Ссылка">
          <InlineField
            fieldKey="url"
            label="Ссылка на вакансию"
            kind="url"
            value={app.url}
            display={app.url?.replace(/^https?:\/\//, "")}
            href={app.url}
            emptyText="Добавить ссылку"
            placeholder="https://example.com/jobs/123"
            onSave={(value) => update({ url: value })}
          />
        </Row>
        <Row label="Зарплата">
          <InlineGroupField
            fieldKey="salary"
            label="Зарплата"
            values={{
              min: app.salaryMin?.toString() ?? "",
              max: app.salaryMax?.toString() ?? "",
              currency: app.currency ?? "",
            }}
            display={salary}
            ariaValue={salary}
            emptyText="Добавить зарплату"
            parts={[
              { key: "min", label: "Зарплата от", placeholder: "от", inputMode: "numeric" },
              { key: "max", label: "Зарплата до", placeholder: "до", inputMode: "numeric" },
              { key: "currency", label: "Валюта", placeholder: "RUB", maxLength: 5, className: "max-w-20" },
            ]}
            onSave={async (values) => {
              const min = parseAmount(values.min);
              const max = parseAmount(values.max);
              if (min === "invalid" || max === "invalid") return "Зарплата — только числа";
              return update({ salaryMin: min, salaryMax: max, currency: values.currency });
            }}
          />
        </Row>
        <Row label="Формат">
          <InlineField
            fieldKey="workFormat"
            label="Формат работы"
            kind="select"
            value={app.workFormat}
            display={app.workFormat ? WORK_FORMAT_LABELS[app.workFormat] : null}
            options={WORK_FORMATS.map((format) => ({ value: format, label: WORK_FORMAT_LABELS[format] }))}
            emptyText="Выбрать формат"
            onSave={(value) => update({ workFormat: (value as ApplicationPatch["workFormat"]) ?? null })}
          />
        </Row>
        <Row label="Город">
          <InlineField
            fieldKey="location"
            label="Город"
            value={app.location}
            emptyText="Добавить город"
            placeholder="Москва"
            onSave={(value) => update({ location: value ?? "" })}
          />
        </Row>
        <Row label="Контакт">
          <InlineGroupField
            fieldKey="contact"
            label="Контакт"
            values={{ name: app.contactName ?? "", info: app.contactInfo ?? "" }}
            display={contact}
            ariaValue={contact}
            href={contactHref(app.contactInfo)}
            emptyText="Добавить контакт"
            parts={[
              { key: "name", label: "Имя контакта", placeholder: "Имя" },
              { key: "info", label: "Email или Telegram", placeholder: "name@example.com" },
            ]}
            onSave={(values) => update({ contactName: values.name, contactInfo: values.info })}
          />
        </Row>
        <Row label="Источник">
          <InlineField
            fieldKey="source"
            label="Источник"
            value={app.source}
            emptyText="Добавить источник"
            placeholder="hh.ru"
            onSave={(value) => update({ source: value ?? "" })}
          />
        </Row>
      </dl>
    </section>
  );
}
