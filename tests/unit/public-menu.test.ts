import { describe, expect, it } from "vitest";
import { formatPrice } from "../../src/lib/menu-display";

describe("formatPrice", () => {
  it("includes the amount in the selected language", () => {
    expect(formatPrice(25, "EGP", "en")).toContain("25");
    expect(formatPrice("10.5", "USD", "ar")).toContain("١٠");
  });
});
