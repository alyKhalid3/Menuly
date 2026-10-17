import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { admin, createOwner, deleteOwner } from "./setup";

const created: string[] = [];

afterEach(async () => {
  while (created.length) await deleteOwner(created.pop()!);
});

async function seedMenu(ownerId: string, slug: string | null) {
  const { data: restaurant, error } = await admin
    .from("restaurants")
    .insert({ owner_id: ownerId, name: "Roma" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: menu, error: menuError } = await admin
    .from("menus")
    .insert({
      restaurant_id: restaurant.id,
      template_id: "classic",
      primary_language: "ar",
      currency: "EGP",
      slug,
      slug_confirmed_at: slug ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (menuError) throw menuError;
  return { restaurantId: restaurant.id, menuId: menu.id };
}

describe("tenant isolation", () => {
  it("hides one owner's menu from another owner", async () => {
    const a = await createOwner(`a-${randomUUID()}@example.com`);
    const b = await createOwner(`b-${randomUUID()}@example.com`);
    created.push(a.id, b.id);
    const { menuId } = await seedMenu(a.id, null);

    const { data } = await b.client.from("menus").select("id").eq("id", menuId);
    expect(data).toEqual([]);

    const update = await b.client.from("menus").update({ currency: "USD" }).eq("id", menuId);
    expect(update.error).toBeNull();
    const { data: unchanged } = await admin.from("menus").select("currency").eq("id", menuId).single();
    expect(unchanged?.currency).toBe("EGP");
  });

  it("refuses a second change to a confirmed slug", async () => {
    const a = await createOwner(`slug-${randomUUID()}@example.com`);
    created.push(a.id);
    const slug = `roma-${randomUUID().slice(0, 8)}`;
    const { menuId } = await seedMenu(a.id, slug);
    const change = await a.client.from("menus").update({ slug: "other-name" }).eq("id", menuId);
    expect(change.error).not.toBeNull();
  });

  it("refuses a reserved slug and exposes only public fields", async () => {
    const a = await createOwner(`pub-${randomUUID()}@example.com`);
    created.push(a.id);
    const slug = `roma-${randomUUID().slice(0, 8)}`;
    const { menuId } = await seedMenu(a.id, null);
    const reserved = await a.client.rpc("confirm_menu_slug", {
      p_menu_id: menuId,
      p_slug: "admin",
    });
    expect(reserved.error).not.toBeNull();

    const confirmed = await admin
      .from("menus")
      .update({ slug, slug_confirmed_at: new Date().toISOString() })
      .eq("id", menuId);
    expect(confirmed.error).toBeNull();

    const { createClient } = await import("@supabase/supabase-js");
    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data } = await publicClient.rpc("get_public_menu", { p_slug: slug });
    expect(data.restaurant_name).toBe("Roma");
    expect(JSON.stringify(data)).not.toContain(a.id);
  });

  it("returns false once a user passes the rate limit", async () => {
    const a = await createOwner(`rate-${randomUUID()}@example.com`);
    created.push(a.id);
    const calls = [];
    for (let i = 0; i < 3; i += 1) {
      calls.push(await a.client.rpc("check_rate_limit", { p_action: "test", p_max: 2 }));
    }
    expect(calls.map((call) => call.data)).toEqual([true, true, false]);
  });
});
