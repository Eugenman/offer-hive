const LOCALE = "en-US";

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const numberFormatter = new Intl.NumberFormat(LOCALE);

// Dates without time are stored as YYYY-MM-DD and formatted in UTC so server and client agree.
export function formatDate(value: string | null) {
  if (!value) return null;
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function formatSalary(min: number | null, max: number | null, currency: string | null) {
  if (min === null && max === null) return null;
  const suffix = currency ? ` ${currency}` : "";
  if (min !== null && max !== null) {
    return `${numberFormatter.format(min)}–${numberFormatter.format(max)}${suffix}`;
  }
  if (min !== null) return `from ${numberFormatter.format(min)}${suffix}`;
  return `up to ${numberFormatter.format(max!)}${suffix}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Timestamps in the user's time zone, e.g. "Oct 30, 2026, 3:00 PM". Client-rendered only. */
export function formatDateTime(value: string | null) {
  if (!value) return null;
  return dateTimeFormatter.format(new Date(value));
}

/** ISO timestamp → value for <input type="datetime-local"> in the user's time zone. */
export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
