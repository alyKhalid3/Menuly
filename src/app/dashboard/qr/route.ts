import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "png" && format !== "svg") {
    return NextResponse.json({ error: "Use png or svg." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.redirect(new URL("/login", request.url));
  const { data, error } = await supabase.from("restaurants").select("menus(slug)").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const menu = data?.menus as { slug: string | null } | { slug: string | null }[] | null;
  const slug = Array.isArray(menu) ? menu[0]?.slug : menu?.slug;
  if (!slug) return NextResponse.json({ error: "Confirm a public name first." }, { status: 404 });

  const origin = new URL(request.url).origin;
  const menuUrl = `${origin}/${slug}`;
  const filename = `menuly-${slug}.${format}`;
  if (format === "svg") {
    const svg = await QRCode.toString(menuUrl, { type: "svg", margin: 2 });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  const png = await QRCode.toBuffer(menuUrl, { type: "png", width: 1024, margin: 2 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
