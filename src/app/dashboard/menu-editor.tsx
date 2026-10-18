import {
  createMenu,
  deleteItem,
  deleteSection,
  moveItem,
  moveSection,
  saveExtras,
  saveItem,
  saveSection,
  updateMenu,
} from "@/actions/menu";
import { currencies, templates } from "@/lib/menu-schema";
import type { Language } from "@/lib/menu-text";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "./action-form";
import { SlugPanel } from "./slug-panel";

type Item = {
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

type Section = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  position: number;
  items: Item[];
};

export type OwnedMenu = {
  restaurantName: string;
  menuId: string;
  templateId: "classic" | "modern";
  primaryLanguage: Language;
  secondaryLanguage: Language | null;
  currency: string;
  slug: string | null;
  tagline: string;
  accent: string;
  sections: Section[];
};

function imageUrl(path: string) {
  return createClient().then((supabase) => {
    return supabase.storage.from("menu-images").getPublicUrl(`${path}-sm.webp`).data.publicUrl;
  });
}

export function CreateMenuForm() {
  return (
    <ActionForm action={createMenu} className="mt-8 grid gap-3">
      <h2 className="text-lg font-semibold">Create your menu</h2>
      <NameFields />
      <SettingsFields showExtras />
      <button type="submit">Create menu</button>
    </ActionForm>
  );
}

export async function MenuEditor({ menu, origin }: { menu: OwnedMenu; origin: string }) {
  const sections = [...menu.sections].sort((a, b) => a.position - b.position);
  return (
    <div className="mt-8 grid gap-8">
      <SlugPanel slug={menu.slug} origin={origin} />
      <ActionForm action={updateMenu} className="grid gap-3">
        <h2 className="text-lg font-semibold">Menu</h2>
        <NameFields restaurantName={menu.restaurantName} />
        <SettingsFields
          primaryLanguage={menu.primaryLanguage}
          secondaryLanguage={menu.secondaryLanguage}
          currency={menu.currency}
          templateId={menu.templateId}
        />
        <button type="submit">Save menu</button>
      </ActionForm>

      <ActionForm action={saveExtras} className="grid gap-3">
        <h2 className="text-lg font-semibold">Template details</h2>
        <p>These stay with {menu.templateId}. Switching templates and coming back restores them.</p>
        <label>
          Tagline
          <input name="tagline" defaultValue={menu.tagline} maxLength={120} className="block w-full border p-2" />
        </label>
        <label>
          Accent color
          <input name="accent" defaultValue={menu.accent} placeholder="#1f6f5b" className="block w-full border p-2" />
        </label>
        <button type="submit">Save template details</button>
      </ActionForm>

      <section className="grid gap-6">
        <h2 className="text-lg font-semibold">Sections</h2>
        {sections.map((section, index) => (
          <SectionCard key={section.id} section={section} menu={menu} index={index} count={sections.length} />
        ))}
        <ActionForm action={saveSection} className="grid gap-3 border p-4">
          <h3 className="font-semibold">New section</h3>
          <BilingualNames primary={menu.primaryLanguage} secondary={menu.secondaryLanguage} />
          <button type="submit">Add section</button>
        </ActionForm>
      </section>
    </div>
  );
}

async function SectionCard({
  section,
  menu,
  index,
  count,
}: {
  section: Section;
  menu: OwnedMenu;
  index: number;
  count: number;
}) {
  const items = [...(section.items ?? [])].sort((a, b) => a.position - b.position);
  return (
    <article className="grid gap-4 border p-4">
      <ActionForm action={saveSection} className="grid gap-3">
        <input type="hidden" name="sectionId" value={section.id} />
        <BilingualNames
          primary={menu.primaryLanguage}
          secondary={menu.secondaryLanguage}
          nameAr={section.name_ar}
          nameEn={section.name_en}
        />
        <button type="submit">Save section</button>
      </ActionForm>
      <div className="flex gap-2">
        <MoveButtons action={moveSection} idName="sectionId" id={section.id} parentName="menuId" parentId={menu.menuId} index={index} count={count} />
        <ActionForm action={deleteSection}>
          <input type="hidden" name="sectionId" value={section.id} />
          <button type="submit">Delete section</button>
        </ActionForm>
      </div>
      {await Promise.all(items.map(async (item, itemIndex) => (
        <ItemCard key={item.id} item={item} sectionId={section.id} menu={menu} index={itemIndex} count={items.length} />
      )))}
      <ActionForm action={saveItem} className="grid gap-3">
        <h3 className="font-semibold">New item</h3>
        <input type="hidden" name="sectionId" value={section.id} />
        <ItemFields primary={menu.primaryLanguage} secondary={menu.secondaryLanguage} currency={menu.currency} />
        <button type="submit">Add item</button>
      </ActionForm>
    </article>
  );
}

async function ItemCard({
  item,
  sectionId,
  menu,
  index,
  count,
}: {
  item: Item;
  sectionId: string;
  menu: OwnedMenu;
  index: number;
  count: number;
}) {
  const preview = item.image_path ? await imageUrl(item.image_path) : null;
  return (
    <div className="grid gap-3 border-t pt-4">
      <ActionForm action={saveItem} className="grid gap-3">
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="itemId" value={item.id} />
        <ItemFields
          primary={menu.primaryLanguage}
          secondary={menu.secondaryLanguage}
          currency={menu.currency}
          item={item}
        />
        {preview ? (
          // The file is already a small WebP from our upload step. next/image would need the project's Supabase host configured first.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-24 w-24 object-cover" />
        ) : null}
        <label>
          Replace photo
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full" />
        </label>
        <button type="submit">Save item</button>
      </ActionForm>
      <div className="flex gap-2">
        <MoveButtons action={moveItem} idName="itemId" id={item.id} parentName="sectionId" parentId={sectionId} index={index} count={count} />
        <ActionForm action={deleteItem}>
          <input type="hidden" name="itemId" value={item.id} />
          <button type="submit">Delete item</button>
        </ActionForm>
      </div>
    </div>
  );
}

function NameFields({ restaurantName = "" }: { restaurantName?: string }) {
  return (
    <label>
      Restaurant name
      <input name="restaurantName" required defaultValue={restaurantName} maxLength={100} className="block w-full border p-2" />
    </label>
  );
}

function SettingsFields({
  primaryLanguage = "ar",
  secondaryLanguage = null,
  currency = "EGP",
  templateId = "classic",
  showExtras = false,
}: {
  primaryLanguage?: Language;
  secondaryLanguage?: Language | null;
  currency?: string;
  templateId?: string;
  showExtras?: boolean;
}) {
  return (
    <>
      <label>
        Primary language
        <select name="primaryLanguage" defaultValue={primaryLanguage} className="block w-full border p-2">
          <option value="ar">Arabic</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        Second language
        <select name="secondaryLanguage" defaultValue={secondaryLanguage ?? ""} className="block w-full border p-2">
          <option value="">None</option>
          <option value="ar">Arabic</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        Currency
        <select name="currency" defaultValue={currency} className="block w-full border p-2">
          {currencies.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </label>
      <label>
        Template
        <select name="templateId" defaultValue={templateId} className="block w-full border p-2">
          {templates.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>
      {showExtras ? (
        <>
          <label>
            Tagline
            <input name="tagline" maxLength={120} className="block w-full border p-2" />
          </label>
          <label>
            Accent color
            <input name="accent" placeholder="#1f6f5b" className="block w-full border p-2" />
          </label>
        </>
      ) : null}
    </>
  );
}

function BilingualNames({
  primary,
  secondary,
  nameAr = "",
  nameEn = "",
}: {
  primary: Language;
  secondary: Language | null;
  nameAr?: string | null;
  nameEn?: string | null;
}) {
  return (
    <>
      {(primary === "ar" || secondary === "ar") && (
        <label>
          Arabic name {primary === "ar" ? "(required)" : "(optional)"}
          <input name="nameAr" required={primary === "ar"} defaultValue={nameAr ?? ""} maxLength={80} className="block w-full border p-2" />
        </label>
      )}
      {(primary === "en" || secondary === "en") && (
        <label>
          English name {primary === "en" ? "(required)" : "(optional)"}
          <input name="nameEn" required={primary === "en"} defaultValue={nameEn ?? ""} maxLength={80} className="block w-full border p-2" />
        </label>
      )}
    </>
  );
}

function ItemFields({
  primary,
  secondary,
  currency,
  item,
}: {
  primary: Language;
  secondary: Language | null;
  currency: string;
  item?: Item;
}) {
  return (
    <>
      <BilingualNames primary={primary} secondary={secondary} nameAr={item?.name_ar} nameEn={item?.name_en} />
      {(primary === "ar" || secondary === "ar") && (
        <label>
          Arabic description
          <textarea name="descriptionAr" defaultValue={item?.description_ar ?? ""} maxLength={400} className="block w-full border p-2" />
        </label>
      )}
      {(primary === "en" || secondary === "en") && (
        <label>
          English description
          <textarea name="descriptionEn" defaultValue={item?.description_en ?? ""} maxLength={400} className="block w-full border p-2" />
        </label>
      )}
      <label>
        Price ({currency})
        <input name="price" type="number" min="0" step="0.01" required defaultValue={item ? Number(item.price) : ""} className="block w-full border p-2" />
      </label>
      <label className="flex items-center gap-2">
        <input name="isAvailable" type="checkbox" defaultChecked={item ? item.is_available : true} />
        Available
      </label>
      {!item ? (
        <label>
          Photo
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full" />
        </label>
      ) : null}
    </>
  );
}

function MoveButtons({
  action,
  idName,
  id,
  parentName,
  parentId,
  index,
  count,
}: {
  action: (formData: FormData) => Promise<{ error: string } | void>;
  idName: string;
  id: string;
  parentName: string;
  parentId: string;
  index: number;
  count: number;
}) {
  return (
    <>
      {index > 0 ? (
        <ActionForm action={action}>
          <input type="hidden" name={idName} value={id} />
          <input type="hidden" name={parentName} value={parentId} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit">Move up</button>
        </ActionForm>
      ) : null}
      {index < count - 1 ? (
        <ActionForm action={action}>
          <input type="hidden" name={idName} value={id} />
          <input type="hidden" name={parentName} value={parentId} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit">Move down</button>
        </ActionForm>
      ) : null}
    </>
  );
}
