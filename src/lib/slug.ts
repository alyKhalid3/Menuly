const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && SLUG.test(slug);
}
