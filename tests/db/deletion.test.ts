import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { deleteOwnerAccount } from "../../src/lib/account";
import { admin, createOwner } from "./setup";

describe("deleteOwnerAccount", () => {
  it("holds a confirmed slug for 90 days and removes the user", async () => {
    const owner = await createOwner(`del-${randomUUID()}@example.com`);
    const slug = `held-${randomUUID().slice(0, 8)}`;
    const { data: restaurant } = await admin
      .from("restaurants")
      .insert({ owner_id: owner.id, name: "Roma" })
      .select("id")
      .single();
    await admin.from("menus").insert({
      restaurant_id: restaurant!.id,
      template_id: "classic",
      primary_language: "en",
      currency: "EGP",
      slug,
      slug_confirmed_at: new Date().toISOString(),
    });

    await deleteOwnerAccount(owner.id);

    const { data: user } = await admin.auth.admin.getUserById(owner.id);
    expect(user.user).toBeNull();
    const { data: hold } = await admin.from("slug_holds").select("reason, available_at").eq("slug", slug).single();
    expect(hold?.reason).toBe("released");
    const availableAt = new Date(hold!.available_at).getTime();
    expect(availableAt).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);
  });

  it("refreshes a released hold and still deletes the user", async () => {
    const owner = await createOwner(`retry-${randomUUID()}@example.com`);
    const slug = `held-${randomUUID().slice(0, 8)}`;
    const { data: restaurant } = await admin
      .from("restaurants")
      .insert({ owner_id: owner.id, name: "Roma" })
      .select("id")
      .single();
    await admin.from("menus").insert({
      restaurant_id: restaurant!.id,
      template_id: "classic",
      primary_language: "en",
      currency: "EGP",
      slug,
      slug_confirmed_at: new Date().toISOString(),
    });
    const earlier = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const { error: holdError } = await admin.from("slug_holds").insert({
      slug,
      reason: "released",
      available_at: earlier,
    });
    if (holdError) throw holdError;

    await deleteOwnerAccount(owner.id);

    const { data: user } = await admin.auth.admin.getUserById(owner.id);
    expect(user.user).toBeNull();
    const { data: hold } = await admin.from("slug_holds").select("reason, available_at").eq("slug", slug).single();
    expect(hold?.reason).toBe("released");
    expect(new Date(hold!.available_at).getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);
  });
});
