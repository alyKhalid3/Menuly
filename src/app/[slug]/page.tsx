import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { classicFont, modernFont } from "@/app/fonts";
import { loadPublicMenu } from "@/lib/public-menu";
import { MenuView } from "./menu-view";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const menu = await loadPublicMenu(slug);
  if (!menu) return { title: "Menu" };
  return { title: menu.restaurant_name };
}

export default async function PublicMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await loadPublicMenu(slug);
  if (!menu) notFound();
  return <MenuView menu={menu} classicFont={classicFont.className} modernFont={modernFont.className} />;
}
