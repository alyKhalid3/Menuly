import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Menuly",
  description: "A digital menu for your restaurant, with a link and a QR code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
