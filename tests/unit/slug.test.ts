import { describe, expect, it } from "vitest";
import { isValidSlugFormat } from "../../src/lib/slug";

describe("isValidSlugFormat", () => {
  it.each(["roma", "pizza-roma", "cafe-12"])("accepts %s", (slug) => {
    expect(isValidSlugFormat(slug)).toBe(true);
  });

  it.each([
    "a1",
    "ab",
    "A",
    "Pizza",
    "-roma",
    "roma-",
    "pizza--roma",
    "pizza_roma",
    "بيتزا",
    "a".repeat(41),
  ])("rejects %s", (slug) => {
    expect(isValidSlugFormat(slug)).toBe(false);
  });
});
