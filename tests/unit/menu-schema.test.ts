import { describe, expect, it } from "vitest";
import { menuSettingsSchema } from "../../src/lib/menu-schema";

describe("menuSettingsSchema", () => {
  it("accepts a menu and rejects a repeated language", () => {
    const valid = menuSettingsSchema.safeParse({
      restaurantName: "Roma",
      primaryLanguage: "ar",
      secondaryLanguage: "en",
      currency: "EGP",
      templateId: "classic",
      tagline: "",
      accent: "",
    });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.accent).toBeNull();

    const repeated = menuSettingsSchema.safeParse({
      restaurantName: "Roma",
      primaryLanguage: "ar",
      secondaryLanguage: "ar",
      currency: "EGP",
      templateId: "classic",
      tagline: "",
      accent: "",
    });
    expect(repeated.success).toBe(false);
  });
});
