const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

// Dates without time are stored as YYYY-MM-DD and formatted in UTC so server and client agree.
export function formatDate(value: string | null) {
  if (!value) return null;
  return dateFormatter.format(new Date(`${value}T00:00:00Z`)).replace(" г.", "");
}

export function formatSalary(min: number | null, max: number | null, currency: string | null) {
  if (min === null && max === null) return null;
  const suffix = currency ? ` ${currency}` : "";
  if (min !== null && max !== null) {
    return `${numberFormatter.format(min)}–${numberFormatter.format(max)}${suffix}`;
  }
  if (min !== null) return `от ${numberFormatter.format(min)}${suffix}`;
  return `до ${numberFormatter.format(max!)}${suffix}`;
}
