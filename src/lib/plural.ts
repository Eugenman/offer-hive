const rules = new Intl.PluralRules("en-US");

/** plural(3, "application", "applications") → "applications" */
export function plural(count: number, one: string, other: string) {
  return rules.select(count) === "one" ? one : other;
}

/** "1 application", "3 applications" */
export function countApplications(count: number) {
  return `${count} ${plural(count, "application", "applications")}`;
}
