"use client";

import { useState } from "react";
import { textFor, type Language } from "@/lib/menu-text";
import { formatPrice, publicImageUrl } from "@/lib/menu-display";
import type { PublicItem, PublicMenu, PublicSection } from "@/lib/public-menu";

export function MenuView({
  menu,
  classicFont,
  modernFont,
}: {
  menu: PublicMenu;
  classicFont: string;
  modernFont: string;
}) {
  const [language, setLanguage] = useState<Language>(menu.primary_language);
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const dir = language === "ar" ? "rtl" : "ltr";
  const classic = menu.template_id === "classic";
  const accent = menu.extras.accent || (classic ? "#8c3f2a" : "#d6ff4a");
  const other = menu.secondary_language ? (language === "ar" ? "English" : "العربية") : null;

  const sections = menu.sections.map((section) => ({
    ...section,
    title: textFor(language, menu.primary_language, section.name_ar, section.name_en),
    items: section.items.map((item) => ({
      ...item,
      title: textFor(language, menu.primary_language, item.name_ar, item.name_en),
      description: textFor(language, menu.primary_language, item.description_ar, item.description_en).trim(),
      price: formatPrice(item.price, menu.currency, language),
    })),
  }));

  return (
    <article dir={dir} lang={language} className={classic ? classicFont : modernFont} style={{ background: classic ? "#f3ead7" : "#12110f", color: classic ? "#2a2118" : "#f6f1e8", minHeight: "100vh" }}>
      <div className="mx-auto max-w-lg px-5 py-10">
        <header className="mb-10">
          <p className="text-xs tracking-[0.28em] uppercase" style={{ color: accent }}>
            {classic ? (language === "ar" ? "قائمة" : "Menu") : (language === "ar" ? "الليلة" : "Tonight")}
          </p>
          <h1 className="mt-3 text-5xl leading-none" style={{ fontWeight: 700 }}>{menu.restaurant_name}</h1>
          {menu.extras.tagline ? <p className="mt-4 max-w-sm text-lg opacity-80">{menu.extras.tagline}</p> : null}
          <div className="mt-5 h-px w-16" style={{ background: accent }} />
          {other ? (
            <button type="button" className="mt-6 border px-4 py-2 text-sm" style={{ borderColor: accent, color: accent }} onClick={() => setLanguage(language === "ar" ? "en" : "ar")}>
              {other}
            </button>
          ) : null}
        </header>
        {sections.map((section) => (
          <SectionBlock key={section.id} section={section} classic={classic} accent={accent} language={language} onPhoto={setOpenPhoto} />
        ))}
      </div>
      {openPhoto ? (
        <button type="button" className="fixed inset-0 z-10 flex items-center justify-center bg-black/80 p-6" onClick={() => setOpenPhoto(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={openPhoto} alt="" className="max-h-[80vh] w-full max-w-lg object-contain" />
        </button>
      ) : null}
    </article>
  );
}

type ShownItem = PublicItem & { title: string; description: string; price: string };
type ShownSection = Omit<PublicSection, "items"> & { title: string; items: ShownItem[] };

function SectionBlock({
  section,
  classic,
  accent,
  language,
  onPhoto,
}: {
  section: ShownSection;
  classic: boolean;
  accent: string;
  language: Language;
  onPhoto: (url: string) => void;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl" style={{ color: accent, fontWeight: 700 }}>{section.title}</h2>
      <ul className="mt-4">
        {section.items.map((item) => (
          <li key={item.id} className="border-b py-4" style={{ borderColor: classic ? "rgba(42,33,24,0.15)" : "rgba(246,241,232,0.12)", opacity: item.is_available ? 1 : 0.55 }}>
            <div className="flex items-baseline gap-3">
              <h3 className="text-lg">{item.title}</h3>
              <span className="mb-1 h-px flex-1 border-b border-dotted" style={{ borderColor: classic ? "rgba(42,33,24,0.35)" : "rgba(246,241,232,0.35)" }} />
              <p className="shrink-0">{item.price}</p>
            </div>
            {item.description ? <p className="mt-1 max-w-sm text-sm opacity-75">{item.description}</p> : null}
            {item.is_available ? null : <p className="mt-1 text-xs tracking-wide uppercase">{language === "ar" ? "غير متاح" : "Unavailable"}</p>}
            {item.image_path ? (
              <button type="button" className="mt-3 block" onClick={() => onPhoto(publicImageUrl(item.image_path!, "lg"))}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicImageUrl(item.image_path, "sm")} alt="" className="h-28 w-40 object-cover" style={{ borderRadius: classic ? 0 : "1rem" }} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
