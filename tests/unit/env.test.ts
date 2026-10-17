import { afterEach, describe, expect, it } from "vitest";
import { publicEnv } from "../../src/lib/env";
import { serverEnv } from "../../src/lib/env.server";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("env", () => {
  it("rejects a missing public url", () => {
    expect(() => publicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns the public values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    expect(publicEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "publishable",
    });
  });

  it("rejects a missing secret key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    expect(() => serverEnv()).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
