"use server";

import { revalidatePath } from "next/cache";
import { isValidSlugFormat } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

async function limited(
  action: "slug" | "write",
  max: number,
): Promise<{ supabase: Awaited<ReturnType<typeof createClient>> } | { error: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "You need to log in again." as const };
  const limit = await supabase.rpc("check_rate_limit", { p_action: action, p_max: max });
  if (limit.error || limit.data !== true) return { error: "Too many requests. Wait a minute and try again." as const };
  return { supabase };
}

export async function checkSlug(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!isValidSlugFormat(slug)) {
    return { status: "invalid" as const, slug };
  }
  const gated = await limited("slug", 20);
  if ("error" in gated) return { status: "error" as const, slug, error: gated.error };
  const { data, error } = await gated.supabase.rpc("is_slug_available", { p_slug: slug });
  if (error) return { status: "error" as const, slug, error: error.message };
  return { status: data ? ("available" as const) : ("taken" as const), slug };
}

export async function confirmSlug(formData: FormData): Promise<{ error: string } | void> {
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (formData.get("final") !== "yes") {
    return { error: "Confirm that this name is final before saving it." };
  }
  if (!isValidSlugFormat(slug)) return { error: "That name is not available." };
  const gated = await limited("write", 30);
  if ("error" in gated) return { error: gated.error };
  const { data: restaurant, error: readError } = await gated.supabase
    .from("restaurants")
    .select("menus(id)")
    .maybeSingle();
  if (readError) return { error: readError.message };
  const menu = restaurant?.menus as { id: string } | { id: string }[] | null;
  const menuId = Array.isArray(menu) ? menu[0]?.id : menu?.id;
  if (!menuId) return { error: "Create a menu first." };
  const { error } = await gated.supabase.rpc("confirm_menu_slug", { p_menu_id: menuId, p_slug: slug });
  if (error) return { error: "That name is not available." };
  revalidatePath("/dashboard");
  revalidatePath(`/${slug}`);
}
