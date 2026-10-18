import { revalidatePath } from "next/cache";
import { buildItemImages, imageObjectPath, imagePrefix } from "@/lib/image-store";
import { missingPrimaryNames, type Language } from "@/lib/menu-text";
import { extrasSchema, itemSchema, menuSettingsSchema, primaryName, sectionSchema } from "@/lib/menu-schema";
import { moveId } from "@/lib/reorder";
import { createClient } from "@/lib/supabase/server";

type ActionError = { error: string };
type MenuRow = {
  id: string;
  primary_language: Language;
  slug: string | null;
};
type Owned = { restaurantId: string; menu: MenuRow } | ActionError;

async function gate(action: "write" | "upload"): Promise<{ supabase: Awaited<ReturnType<typeof createClient>> } | ActionError> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "You need to log in again." };
  const max = action === "upload" ? 10 : 30;
  const limit = await supabase.rpc("check_rate_limit", { p_action: action, p_max: max });
  if (limit.error || limit.data !== true) return { error: "Too many requests. Wait a minute and try again." };
  return { supabase };
}

function readSettings(formData: FormData) {
  const secondary = formData.get("secondaryLanguage");
  return menuSettingsSchema.safeParse({
    restaurantName: formData.get("restaurantName"),
    primaryLanguage: formData.get("primaryLanguage"),
    secondaryLanguage: secondary === "ar" || secondary === "en" ? secondary : null,
    currency: formData.get("currency"),
    templateId: formData.get("templateId"),
    tagline: formData.get("tagline") ?? "",
    accent: formData.get("accent") ?? "",
  });
}

async function ownedMenu(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Owned> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, menus(id, primary_language, slug)")
    .maybeSingle();
  if (error) return { error: error.message };
  const raw = data?.menus as MenuRow | MenuRow[] | null;
  const menu = Array.isArray(raw) ? raw[0] : raw;
  if (!data || !menu) return { error: "Create a menu first." };
  return { restaurantId: data.id as string, menu };
}

function refresh(slug: string | null) {
  revalidatePath("/dashboard");
  if (slug) revalidatePath(`/${slug}`);
}

export async function createMenu(formData: FormData) {
  "use server";
  const parsed = readSettings(formData);
  if (!parsed.success) return { error: "Check the restaurant name, languages, currency, and template." };
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const { supabase } = gated;
  const { data: userData } = await supabase.auth.getClaims();
  const ownerId = userData?.claims?.sub;
  if (!ownerId) return { error: "You need to log in again." };

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .insert({ owner_id: ownerId, name: parsed.data.restaurantName })
    .select("id")
    .single();
  if (restaurantError) return { error: restaurantError.message };

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .insert({
      restaurant_id: restaurant.id,
      template_id: parsed.data.templateId,
      primary_language: parsed.data.primaryLanguage,
      secondary_language: parsed.data.secondaryLanguage,
      currency: parsed.data.currency,
    })
    .select("id")
    .single();
  if (menuError) return { error: menuError.message };

  const { error: extrasError } = await supabase.from("template_extras").insert({
    menu_id: menu.id,
    template_id: parsed.data.templateId,
    data: { tagline: parsed.data.tagline, accent: parsed.data.accent },
  });
  if (extrasError) return { error: extrasError.message };
  refresh(null);
}

export async function updateMenu(formData: FormData) {
  "use server";
  const parsed = readSettings(formData);
  if (!parsed.success) return { error: "Check the restaurant name, languages, currency, and template." };
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const owned = await ownedMenu(gated.supabase);
  if ("error" in owned) return owned;

  if (parsed.data.primaryLanguage !== owned.menu.primary_language) {
    const names = await loadNames(gated.supabase, owned.menu.id);
    if ("error" in names) return names;
    const missing = missingPrimaryNames(parsed.data.primaryLanguage, names.rows);
    if (missing.length > 0) {
      return { error: `Add the new primary language to: ${missing.join(", ")}` };
    }
  }

  const { error: restaurantError } = await gated.supabase
    .from("restaurants")
    .update({ name: parsed.data.restaurantName })
    .eq("id", owned.restaurantId);
  if (restaurantError) return { error: restaurantError.message };

  const { error: menuError } = await gated.supabase
    .from("menus")
    .update({
      template_id: parsed.data.templateId,
      primary_language: parsed.data.primaryLanguage,
      secondary_language: parsed.data.secondaryLanguage,
      currency: parsed.data.currency,
    })
    .eq("id", owned.menu.id);
  if (menuError) return { error: menuError.message };

  refresh(owned.menu.slug);
}

export async function saveExtras(formData: FormData) {
  "use server";
  const tagline = formData.get("tagline");
  const accent = formData.get("accent");
  const parsed = extrasSchema.safeParse({
    tagline: typeof tagline === "string" ? tagline : "",
    accent: typeof accent === "string" ? accent : "",
  });
  if (!parsed.success) return { error: "Use a hex color like #1f6f5b, or leave it blank." };
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const owned = await ownedMenu(gated.supabase);
  if ("error" in owned) return owned;
  const { data: menu, error: readError } = await gated.supabase
    .from("menus")
    .select("template_id")
    .eq("id", owned.menu.id)
    .single();
  if (readError) return { error: readError.message };
  const { error } = await gated.supabase.from("template_extras").upsert({
    menu_id: owned.menu.id,
    template_id: menu.template_id,
    data: { tagline: parsed.data.tagline, accent: parsed.data.accent },
  });
  if (error) return { error: error.message };
  refresh(owned.menu.slug);
}

async function loadNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  menuId: string,
): Promise<{ rows: Array<{ label: string; name_ar: string | null; name_en: string | null }> } | ActionError> {
  const { data: sections, error } = await supabase
    .from("sections")
    .select("name_ar, name_en, items(name_ar, name_en)")
    .eq("menu_id", menuId);
  if (error) return { error: error.message };
  const rows = (sections ?? []).flatMap((section) => {
    const sectionRow = { label: section.name_en || section.name_ar || "Section", name_ar: section.name_ar, name_en: section.name_en };
    const items = (section.items as Array<{ name_ar: string | null; name_en: string | null }> | null) ?? [];
    return [sectionRow, ...items.map((item) => ({ label: item.name_en || item.name_ar || "Item", ...item }))];
  });
  return { rows };
}

export async function saveSection(formData: FormData) {
  "use server";
  const parsed = sectionSchema.safeParse({
    nameAr: formData.get("nameAr") ?? "",
    nameEn: formData.get("nameEn") ?? "",
  });
  if (!parsed.success) return { error: "Section names are too long." };
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const owned = await ownedMenu(gated.supabase);
  if ("error" in owned) return owned;
  if (!primaryName(owned.menu.primary_language, parsed.data.nameAr, parsed.data.nameEn)) {
    return { error: "The primary language name is required." };
  }

  const id = formData.get("sectionId");
  if (typeof id === "string" && id) {
    const { error } = await gated.supabase
      .from("sections")
      .update({ name_ar: parsed.data.nameAr, name_en: parsed.data.nameEn })
      .eq("id", id)
      .eq("menu_id", owned.menu.id);
    if (error) return { error: error.message };
  } else {
    const { count, error: countError } = await gated.supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .eq("menu_id", owned.menu.id);
    if (countError) return { error: countError.message };
    const { error } = await gated.supabase.from("sections").insert({
      menu_id: owned.menu.id,
      name_ar: parsed.data.nameAr,
      name_en: parsed.data.nameEn,
      position: count ?? 0,
    });
    if (error) return { error: error.message };
  }
  refresh(owned.menu.slug);
}

export async function deleteSection(formData: FormData) {
  "use server";
  const id = formData.get("sectionId");
  if (typeof id !== "string" || !id) return { error: "Missing section." };
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const owned = await ownedMenu(gated.supabase);
  if ("error" in owned) return owned;
  const { error } = await gated.supabase.from("sections").delete().eq("id", id).eq("menu_id", owned.menu.id);
  if (error) return { error: error.message };
  refresh(owned.menu.slug);
}

export async function moveSection(formData: FormData) {
  "use server";
  return moveRow(formData, "section");
}

export async function saveItem(formData: FormData) {
  "use server";
  const parsed = itemSchema.safeParse({
    nameAr: formData.get("nameAr") ?? "",
    nameEn: formData.get("nameEn") ?? "",
    descriptionAr: formData.get("descriptionAr") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    price: formData.get("price"),
    isAvailable: formData.get("isAvailable") === "on",
  });
  if (!parsed.success) return { error: "Check the item name and price." };
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const owned = await ownedMenu(gated.supabase);
  if ("error" in owned) return owned;
  if (!primaryName(owned.menu.primary_language, parsed.data.nameAr, parsed.data.nameEn)) {
    return { error: "The primary language name is required." };
  }
  const sectionId = formData.get("sectionId");
  if (typeof sectionId !== "string" || !sectionId) return { error: "Missing section." };

  const fields = {
    name_ar: parsed.data.nameAr,
    name_en: parsed.data.nameEn,
    description_ar: parsed.data.descriptionAr,
    description_en: parsed.data.descriptionEn,
    price: parsed.data.price,
    is_available: parsed.data.isAvailable,
  };
  const itemId = formData.get("itemId");
  let savedId = typeof itemId === "string" ? itemId : "";
  if (savedId) {
    const { error } = await gated.supabase.from("items").update(fields).eq("id", savedId).eq("section_id", sectionId);
    if (error) return { error: error.message };
  } else {
    const { count, error: countError } = await gated.supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("section_id", sectionId);
    if (countError) return { error: countError.message };
    const { data, error } = await gated.supabase
      .from("items")
      .insert({ section_id: sectionId, ...fields, position: count ?? 0 })
      .select("id")
      .single();
    if (error) return { error: error.message };
    savedId = data.id;
  }

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const uploaded = await storeImage(gated.supabase, owned.restaurantId, savedId, file);
    if (uploaded && "error" in uploaded) return uploaded;
  }
  refresh(owned.menu.slug);
}

export async function deleteItem(formData: FormData) {
  "use server";
  const id = formData.get("itemId");
  if (typeof id !== "string" || !id) return { error: "Missing item." };
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const owned = await ownedMenu(gated.supabase);
  if ("error" in owned) return owned;
  const { data: item, error: readError } = await gated.supabase.from("items").select("image_path").eq("id", id).maybeSingle();
  if (readError) return { error: readError.message };
  if (item?.image_path) {
    const removed = await removeImages(gated.supabase, item.image_path);
    if (removed) return removed;
  }
  const { error } = await gated.supabase.from("items").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh(owned.menu.slug);
}

export async function moveItem(formData: FormData) {
  "use server";
  return moveRow(formData, "item");
}

async function moveRow(formData: FormData, kind: "section" | "item"): Promise<ActionError | void> {
  const id = formData.get(kind === "section" ? "sectionId" : "itemId");
  const direction = formData.get("direction");
  const parentId = formData.get(kind === "section" ? "menuId" : "sectionId");
  if (typeof id !== "string" || (direction !== "up" && direction !== "down") || typeof parentId !== "string") {
    return { error: "Could not reorder." };
  }
  const gated = await gate("write");
  if ("error" in gated) return gated;
  const owned = await ownedMenu(gated.supabase);
  if ("error" in owned) return owned;
  const table = kind === "section" ? "sections" : "items";
  const parentColumn = kind === "section" ? "menu_id" : "section_id";
  const { data, error } = await gated.supabase
    .from(table)
    .select("id, position")
    .eq(parentColumn, parentId)
    .order("position");
  if (error) return { error: error.message };
  const next = moveId((data ?? []).map((row) => row.id as string), id, direction);
  if (!next) return;
  for (let position = 0; position < next.length; position += 1) {
    const { error: updateError } = await gated.supabase.from(table).update({ position }).eq("id", next[position]);
    if (updateError) return { error: updateError.message };
  }
  refresh(owned.menu.slug);
}

async function storeImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  itemId: string,
  file: File,
) {
  const gated = await supabase.rpc("check_rate_limit", { p_action: "upload", p_max: 10 });
  if (gated.error || gated.data !== true) return { error: "Too many uploads. Wait a minute and try again." };
  let images: { sm: Buffer; lg: Buffer };
  try {
    images = await buildItemImages(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read that image." };
  }
  const { data: existing, error: readError } = await supabase.from("items").select("image_path").eq("id", itemId).single();
  if (readError) return { error: readError.message };
  const version = Date.now().toString();
  const prefix = imagePrefix(restaurantId, itemId, version);
  const smPath = imageObjectPath(restaurantId, itemId, version, "sm");
  const lgPath = imageObjectPath(restaurantId, itemId, version, "lg");
  const bucket = supabase.storage.from("menu-images");
  const smUpload = await bucket.upload(smPath, images.sm, { contentType: "image/webp", cacheControl: "31536000" });
  if (smUpload.error) return { error: smUpload.error.message };
  const lgUpload = await bucket.upload(lgPath, images.lg, { contentType: "image/webp", cacheControl: "31536000" });
  if (lgUpload.error) return { error: lgUpload.error.message };
  const { error } = await supabase.from("items").update({ image_path: prefix }).eq("id", itemId);
  if (error) return { error: error.message };
  if (existing.image_path) await removeImages(supabase, existing.image_path);
}

async function removeImages(supabase: Awaited<ReturnType<typeof createClient>>, prefix: string) {
  const { error } = await supabase.storage.from("menu-images").remove([`${prefix}-sm.webp`, `${prefix}-lg.webp`]);
  if (error) return { error: error.message };
}
