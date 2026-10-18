import { describe, expect, it } from "vitest";
import { missingPrimaryNames, textFor } from "../../src/lib/menu-text";
import { moveId } from "../../src/lib/reorder";

describe("textFor", () => {
  it("falls back to the primary language when the selected one is empty", () => {
    expect(textFor("en", "ar", "قهوة", "")).toBe("قهوة");
    expect(textFor("en", "ar", "قهوة", "Coffee")).toBe("Coffee");
  });
});

describe("missingPrimaryNames", () => {
  it("lists rows that have no text in the primary language", () => {
    expect(
      missingPrimaryNames("en", [
        { label: "Drinks", name_ar: "مشروبات", name_en: "Drinks" },
        { label: "Pizza", name_ar: "بيتزا", name_en: "  " },
      ]),
    ).toEqual(["Pizza"]);
  });
});

describe("moveId", () => {
  it("swaps with the neighbor and refuses the ends", () => {
    expect(moveId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "a", "up")).toBeNull();
  });
});
