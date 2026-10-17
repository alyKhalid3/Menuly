import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "../../src/lib/reserved-slugs";

function routeSegments(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) return [];
    if (entry.startsWith("(") || entry.startsWith("[")) return routeSegments(full);
    return [entry];
  });
}

describe("reserved slugs", () => {
  it("includes every top-level app route plus the fixed reserved names", () => {
    const routes = routeSegments(path.join(process.cwd(), "src", "app"));
    for (const route of routes) expect(RESERVED_SLUGS).toContain(route);
    for (const name of ["admin", "api", "login", "auth"]) {
      expect(RESERVED_SLUGS).toContain(name);
    }
  });

  it("matches the seed in the functions migration", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "0003_functions.sql"),
      "utf8",
    );
    for (const slug of RESERVED_SLUGS) {
      expect(sql).toContain(`'${slug}'`);
    }
  });
});
