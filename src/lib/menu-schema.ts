import { z } from "zod";

export const languages = ["ar", "en"] as const;
export const templates = ["classic", "modern"] as const;
export const currencies = ["EGP", "SAR", "AED", "QAR", "KWD", "BHD", "OMR", "USD", "EUR", "GBP"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const extrasSchema = z.object({
  tagline: optionalText(120),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

export const menuSettingsSchema = z
  .object({
    restaurantName: z.string().trim().min(1).max(100),
    primaryLanguage: z.enum(languages),
    secondaryLanguage: z.enum(languages).nullable(),
    currency: z.enum(currencies),
    templateId: z.enum(templates),
  })
  .and(extrasSchema)
  .refine((value) => value.secondaryLanguage !== value.primaryLanguage, {
    path: ["secondaryLanguage"],
    message: "The second language has to be different from the primary language.",
  });

export const sectionSchema = z.object({
  nameAr: optionalText(80),
  nameEn: optionalText(80),
});

export const itemSchema = z.object({
  nameAr: optionalText(80),
  nameEn: optionalText(80),
  descriptionAr: optionalText(400),
  descriptionEn: optionalText(400),
  price: z.coerce.number().min(0).max(99999999.99),
  isAvailable: z.boolean(),
});

export function primaryName(primary: "ar" | "en", arabic: string | null, english: string | null) {
  return primary === "ar" ? arabic : english;
}
