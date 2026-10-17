import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

async function holdConfirmedSlug(admin: AdminClient, slug: string) {
  const availableAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: hold, error: holdReadError } = await admin
    .from("slug_holds")
    .select("reason")
    .eq("slug", slug)
    .maybeSingle();
  if (holdReadError) throw holdReadError;

  if (!hold) {
    const { error } = await admin.from("slug_holds").insert({
      slug,
      reason: "released",
      available_at: availableAt,
    });
    if (error) throw error;
    return;
  }

  if (hold.reason !== "released") throw new Error("Slug is reserved");

  const { error } = await admin.from("slug_holds").update({ available_at: availableAt }).eq("slug", slug);
  if (error) throw error;
}

export async function deleteOwnerAccount(userId: string) {
  const admin = createAdminClient();
  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, menus(slug)")
    .eq("owner_id", userId)
    .maybeSingle();
  if (restaurantError) throw restaurantError;

  const slug = (restaurant as { menus: { slug: string | null } | null } | null)?.menus?.slug;
  if (slug) await holdConfirmedSlug(admin, slug);

  if (restaurant) {
    const folder = restaurant.id as string;
    const { data: files, error: listError } = await admin.storage.from("menu-images").list(folder);
    if (listError) throw listError;
    if (files && files.length > 0) {
      const { error: removeError } = await admin.storage
        .from("menu-images")
        .remove(files.map((file) => `${folder}/${file.name}`));
      if (removeError) throw removeError;
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
