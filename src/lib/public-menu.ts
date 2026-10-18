import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Language } from "@/lib/menu-text";
import { formatPrice, publicImageUrl } from "@/lib/menu-display";

export { formatPrice, publicImageUrl };

export type PublicItem = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  price: number | string;
  image_path: string | null;
  is_available: boolean;
  position: number;
};

export type PublicSection = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  position: number;
  items: PublicItem[];
};

export type PublicMenu = {
  restaurant_name: string;
  slug: string;
  template_id: "classic" | "modern";
  primary_language: Language;
  secondary_language: Language | null;
  currency: string;
  extras: { tagline?: string | null; accent?: string | null };
  sections: PublicSection[];
};

export async function loadPublicMenu(slug: string): Promise<PublicMenu | null> {
  const env = publicEnv();
  const supabase = createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("get_public_menu", { p_slug: slug });
  if (error) throw error;
  return (data as PublicMenu | null) ?? null;
}
