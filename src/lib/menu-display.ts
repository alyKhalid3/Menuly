import { publicEnv } from "@/lib/env";
import type { Language } from "@/lib/menu-text";

export function formatPrice(amount: number | string, currency: string, language: Language) {
  return new Intl.NumberFormat(language === "ar" ? "ar" : "en", {
    style: "currency",
    currency,
    numberingSystem: language === "ar" ? "arab" : "latn",
  }).format(Number(amount));
}

export function publicImageUrl(imagePath: string, size: "sm" | "lg") {
  const { url } = publicEnv();
  return `${url}/storage/v1/object/public/menu-images/${imagePath}-${size}.webp`;
}
