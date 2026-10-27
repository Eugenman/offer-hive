const rules = new Intl.PluralRules("ru-RU");

/** pluralRu(3, ["отклик", "отклика", "откликов"]) → "отклика" */
export function pluralRu(count: number, [one, few, many]: readonly [string, string, string]) {
  switch (rules.select(count)) {
    case "one":
      return one;
    case "few":
      return few;
    default:
      return many;
  }
}

export const APPLICATION_WORDS = ["отклик", "отклика", "откликов"] as const;
