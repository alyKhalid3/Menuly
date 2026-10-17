const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlugFormat(slug: string): boolean {
  if (slug.length > 40 || !SLUG.test(slug)) return false;
  if (slug.length >= 3) return true;
  return slug.length === 2 && /[0-9]/.test(slug);
}
