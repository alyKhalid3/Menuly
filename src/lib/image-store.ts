import "server-only";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageObjectPath(restaurantId: string, itemId: string, version: string, size: "sm" | "lg") {
  return `${restaurantId}/${itemId}-${version}-${size}.webp`;
}

export function imagePrefix(restaurantId: string, itemId: string, version: string) {
  return `${restaurantId}/${itemId}-${version}`;
}

export async function buildItemImages(input: Buffer) {
  if (input.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }
  const image = sharp(input, { failOn: "error" });
  const meta = await image.metadata();
  if (meta.format !== "jpeg" && meta.format !== "png" && meta.format !== "webp") {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  const sm = await image.clone().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  const lg = await image.clone().resize({ width: 960, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return { sm, lg };
}
