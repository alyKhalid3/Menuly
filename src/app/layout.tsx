import type { Metadata } from "next";
import { modernFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Menuly",
  description: "A digital menu for your restaurant, with a link and a QR code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={modernFont.className}>{children}</body>
    </html>
  );
}
