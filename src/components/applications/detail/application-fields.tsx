"use client";

import { type ApplicationDetails, WORK_FORMATS, WORK_FORMAT_LABELS } from "@/lib/domain";
import { formatDate, formatSalary } from "@/lib/format";
import { useRepository } from "@/lib/repository/provider";
import type { ApplicationPatch } from "@/lib/schemas";
import { DetailCard } from "./detail-card";
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
  const update = (patch: ApplicationPatch) => trySave(() => repository.update(app.id, patch));

  const salary = formatSalary(app.salaryMin, app.salaryMax, app.currency);
  const contact = [app.contactName, app.contactInfo].filter(Boolean).join(" · ") || null;

  return (
    <DetailCard title="Details">
      <dl>
        <Row label="Date applied">
          <InlineField
            fieldKey="appliedAt"
            label="Date applied"
            kind="date"
            value={app.appliedAt}
            display={formatDate(app.appliedAt)}
            emptyText="Add date"
            onSave={(value) => update({ appliedAt: value })}
          />
        </Row>
        <Row label="Link">
          <InlineField
            fieldKey="url"
            label="Job posting link"
            kind="url"
            value={app.url}
            display={app.url?.replace(/^https?:\/\//, "")}
            href={app.url}
            emptyText="Add link"
            placeholder="https://example.com/jobs/123"
            onSave={(value) => update({ url: value })}
          />
        </Row>
        <Row label="Salary">
          <InlineGroupField
            fieldKey="salary"
            label="Salary"
            values={{
              min: app.salaryMin?.toString() ?? "",
              max: app.salaryMax?.toString() ?? "",
              currency: app.currency ?? "",
            }}
            display={salary}
            ariaValue={salary}
            emptyText="Add salary"
            parts={[
              { key: "min", label: "Salary from", placeholder: "from", inputMode: "numeric" },
              { key: "max", label: "Salary to", placeholder: "to", inputMode: "numeric" },
              { key: "currency", label: "Currency", placeholder: "USD", maxLength: 5, className: "max-w-20" },
            ]}
            onSave={async (values) => {
              const min = parseAmount(values.min);
              const max = parseAmount(values.max);
              if (min === "invalid" || max === "invalid") return "Salary: numbers only";
              return update({ salaryMin: min, salaryMax: max, currency: values.currency });
            }}
          />
        </Row>
        <Row label="Work format">
          <InlineField
            fieldKey="workFormat"
            label="Work format"
            kind="select"
            value={app.workFormat}
            display={app.workFormat ? WORK_FORMAT_LABELS[app.workFormat] : null}
            options={WORK_FORMATS.map((format) => ({ value: format, label: WORK_FORMAT_LABELS[format] }))}
            emptyText="Choose format"
            onSave={(value) => update({ workFormat: (value as ApplicationPatch["workFormat"]) ?? null })}
          />
        </Row>
        <Row label="Location">
          <InlineField
            fieldKey="location"
            label="Location"
            value={app.location}
            emptyText="Add location"
            placeholder="Berlin"
            onSave={(value) => update({ location: value ?? "" })}
          />
        </Row>
        <Row label="Contact">
          <InlineGroupField
            fieldKey="contact"
            label="Contact"
            values={{ name: app.contactName ?? "", info: app.contactInfo ?? "" }}
            display={contact}
            ariaValue={contact}
            href={contactHref(app.contactInfo)}
            emptyText="Add contact"
            parts={[
              { key: "name", label: "Contact name", placeholder: "Name" },
              { key: "info", label: "Email or messenger", placeholder: "name@example.com" },
            ]}
            onSave={(values) => update({ contactName: values.name, contactInfo: values.info })}
          />
        </Row>
        <Row label="Source">
          <InlineField
            fieldKey="source"
            label="Source"
            value={app.source}
            emptyText="Add source"
            placeholder="hh.ru"
            onSave={(value) => update({ source: value ?? "" })}
          />
        </Row>
      </dl>
    </DetailCard>
  );
}
