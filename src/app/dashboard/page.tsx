import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteAccount } from "@/actions/account";
import { signOut } from "@/actions/auth";
import type { Language } from "@/lib/menu-text";
import { createClient } from "@/lib/supabase/server";
import { modernFont } from "@/app/fonts";
import { CreateMenuForm, MenuEditor, type OwnedMenu } from "./menu-editor";

type Extras = { tagline?: string | null; accent?: string | null };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const email = data.claims.email as string | undefined;
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select(
      "name, menus(id, template_id, primary_language, secondary_language, currency, slug, sections(id, name_ar, name_en, position, items(id, name_ar, name_en, description_ar, description_en, price, image_path, is_available, position)), template_extras(template_id, data))",
    )
    .maybeSingle();
  if (error) throw error;

  const menuValue = Array.isArray(restaurant?.menus) ? restaurant.menus[0] : restaurant?.menus;
  const menu = menuValue as {
    id: string;
    template_id: "classic" | "modern";
    primary_language: Language;
    secondary_language: Language | null;
    currency: string;
    slug: string | null;
    sections: OwnedMenu["sections"];
    template_extras: Array<{ template_id: string; data: Extras }>;
  } | null;
  const extras = menu?.template_extras?.find((row) => row.template_id === menu.template_id)?.data;

  return (
    <main className={`${modernFont.className} owner mx-auto max-w-3xl px-6 py-16`}>
      <h1 className="text-2xl font-semibold">Your menu</h1>
      <p className="mt-2">Signed in as {email}</p>
      {menu && restaurant ? (
        <MenuEditor
          origin={origin}
          menu={{
            restaurantName: restaurant.name,
            menuId: menu.id,
            templateId: menu.template_id,
            primaryLanguage: menu.primary_language,
            secondaryLanguage: menu.secondary_language,
            currency: menu.currency,
            slug: menu.slug,
            tagline: extras?.tagline ?? "",
            accent: extras?.accent ?? "",
            sections: menu.sections ?? [],
          }}
        />
      ) : (
        <>
          <p className="mt-6">You have not created a menu yet.</p>
          <CreateMenuForm />
        </>
      )}
      <form action={signOut} className="mt-8">
        <button type="submit">Log out</button>
      </form>
      <form action={deleteAccount} className="danger mt-3">
        <button type="submit">Delete account</button>
      </form>
    </main>
  );
}
