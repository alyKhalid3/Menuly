import { describe, expect, it } from "vitest";
import { authSchema } from "../../src/actions/auth";

describe("authSchema", () => {
  it("accepts a normal email and an 8 character password", () => {
    expect(authSchema.safeParse({ email: "owner@example.com", password: "12345678" }).success).toBe(true);
  });

  it("rejects a short password and a bad email", () => {
    expect(authSchema.safeParse({ email: "owner@example.com", password: "short" }).success).toBe(false);
    expect(authSchema.safeParse({ email: "not-an-email", password: "12345678" }).success).toBe(false);
  });
});
