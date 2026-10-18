import { Amiri, Cairo } from "next/font/google";

export const classicFont = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
});

export const modernFont = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
});
