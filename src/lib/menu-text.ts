export type Language = "ar" | "en";

export type NamedText = {
  name_ar: string | null;
  name_en: string | null;
};

export function textFor(language: Language, primary: Language, arabic: string | null, english: string | null) {
  const chosen = language === "ar" ? arabic : english;
  if (chosen && chosen.trim()) return chosen;
  const fallback = primary === "ar" ? arabic : english;
  return fallback ?? "";
}

export function missingPrimaryNames(primary: Language, rows: Array<NamedText & { label: string }>) {
  return rows
    .filter((row) => {
      const value = primary === "ar" ? row.name_ar : row.name_en;
      return !value || value.trim() === "";
    })
    .map((row) => row.label);
}
