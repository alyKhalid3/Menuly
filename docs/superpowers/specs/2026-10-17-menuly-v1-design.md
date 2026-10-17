# Menuly v1 Design

Status: approved 2026-10-17. Source requirements: `System-Requirement.md`. This document records the decisions that resolve its open questions and defines the architecture, data model, security model, testing approach and build order for v1.

## 1. Decisions

| Topic | Decision |
|---|---|
| Restaurants per account | One. Enforced by a unique `restaurants.owner_id`; dropping that constraint later allows more. |
| Menus per restaurant | One. Enforced by a unique `menus.restaurant_id`. One link and one QR code per restaurant. |
| Publishing | No drafts. Every saved edit is live immediately (FR-6). |
| Item images | In v1. Optional, one image per item. |
| Languages | A menu has a required **primary** language (`ar` or `en`) and an optional **secondary** language (the other one). When both exist, visitors get a language switch. |
| Missing translations | Primary-language text is required. Secondary-language text is optional and falls back to the primary on the public page. |
| Currency | Chosen per menu (ISO 4217 code). |
| Unavailable items | `is_available` flag per item. Unavailable items stay visible, marked as unavailable. |
| Account deletion | The menu is deleted and the link returns 404. The slug is held for **90 days**, then becomes available to others. |
| Template-specific fields | Menu level only in v1 (for example cover photo, tagline, accent color). |
| Supabase | Hosted projects: one for development, one for automated tests. Production runs on the Pro plan, because free projects pause after a week of inactivity, which would break printed QR codes. |
| Image storage | Supabase Storage, behind a swappable `imageStore` module. |
| Hosting | Vercel. |
| Package manager | npm. |

## 2. Architecture

One Next.js app (App Router, TypeScript, Tailwind CSS). No separate backend.

### Routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Landing page | Public |
| `/signup`, `/login` | Supabase Auth, email and password | Public |
| `/dashboard/...` | Owner area | Signed-in owners; middleware redirects others to `/login` |
| `/[slug]` | Public menu | Public |

Every top-level route segment (`dashboard`, `login`, `signup`, `api`, `admin`, and any added later) is a reserved slug.

### Data access

- Owner reads and writes use `@supabase/ssr` clients bound to the signed-in user's session, so Row Level Security applies to every owner query. The app never relies on its own filtering for tenant isolation.
- The service-role client exists only in server modules marked `import 'server-only'`. It is used for account deletion, the slug-hold release, and the admin slug change.
- Every mutation is a Server Action: validate input with a shared zod schema, check the rate limit, write, then `revalidatePath('/<slug>')` when the menu has a confirmed slug.

### Public page delivery

`/[slug]` is statically generated with ISR and fetched through `get_public_menu(slug)`. Visitors never hit the database directly on a cached page. The `revalidatePath` call in each write refreshes it immediately. Target: visible content in under 2 seconds on 3G.

### Images

- Upload goes through a Server Action. The server reads the file with `sharp` to determine its real format (JPEG, PNG or WebP accepted) and rejects files over 5 MB.
- Two WebP versions are generated: `sm` (320px wide, for menu lists) and `lg` (960px wide, shown when a visitor taps an item).
- Stored at `menu-images/<restaurant_id>/<item_id>-<version>-sm.webp` and `...-lg.webp`. The version token changes on each upload so cached URLs never serve a stale image. Served with a one-year immutable cache header.
- All storage access goes through `src/lib/image-store.ts` with three functions: `uploadItemImage`, `deleteItemImage`, `getItemImageUrl`. Moving to Cloudinary or another provider later means rewriting only this module.

### Templates

- Each template lives in `src/templates/<id>/` with its React component and a zod schema for its menu-level extra fields.
- The `templates` table holds one row per template for referential integrity.
- Adding a template means adding a folder and a row. Shared code does not change.
- v1 ships `classic` and `modern`. Their visual design is a separate design pass before piece 4.

## 3. Data model

All primary keys are UUIDs unless stated. Foreign keys cascade on delete. Timestamps are `timestamptz` with `now()` defaults.

### `restaurants`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `owner_id` | uuid | FK `auth.users`, **unique** |
| `name` | text | Required, 1 to 100 characters |
| `created_at` | timestamptz | |

### `menus`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `restaurant_id` | uuid | FK `restaurants`, **unique** |
| `slug` | text | Null until confirmed. Unique. Matches `^[a-z0-9]+(-[a-z0-9]+)*$`, length 3 to 40. Immutable once set (trigger), except via `admin_change_slug`. |
| `slug_confirmed_at` | timestamptz | Set together with `slug` |
| `template_id` | text | FK `templates` |
| `primary_language` | text | `ar` or `en` |
| `secondary_language` | text | `ar`, `en` or null; never equal to `primary_language` |
| `currency` | text | ISO 4217 code, three uppercase letters |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by trigger |

### `sections`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `menu_id` | uuid | FK `menus` |
| `name_ar`, `name_en` | text | Nullable; the primary language's column is required by validation |
| `position` | integer | Ordering within the menu |

### `items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `section_id` | uuid | FK `sections` |
| `name_ar`, `name_en` | text | Nullable; the primary language's column is required by validation |
| `description_ar`, `description_en` | text | Optional |
| `price` | numeric(10,2) | `>= 0` |
| `image_path` | text | Null when the item has no image; stores the storage path prefix including the version token |
| `is_available` | boolean | Default `true` |
| `position` | integer | Ordering within the section |

### `templates`

| Column | Type | Notes |
|---|---|---|
| `id` | text | PK: `classic`, `modern` |
| `is_active` | boolean | Default `true` |

### `template_extras`

| Column | Type | Notes |
|---|---|---|
| `menu_id` | uuid | FK `menus` |
| `template_id` | text | FK `templates` |
| `data` | jsonb | Validated on save by the template's zod schema |

Primary key `(menu_id, template_id)`. One row per template the menu has used, so switching templates and back restores the earlier fields (FR-9, FR-10).

### `slug_holds`

| Column | Type | Notes |
|---|---|---|
| `slug` | text | PK |
| `reason` | text | `reserved` (site route names) or `released` (from a deleted account) |
| `available_at` | timestamptz | Null for `reserved` (never available); `now() + 90 days` for `released` |

### `rate_limits`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | |
| `action` | text | |
| `window_start` | timestamptz | Truncated to the minute |
| `count` | integer | |

Primary key `(user_id, action, window_start)`. Rows older than one hour may be deleted.

### Language rules

- Saving a section or item fails if the menu's primary-language name is empty.
- Changing a menu's primary language fails until every section and item has text in the new primary language. The error lists what is missing.
- The public page shows the visitor's selected language and falls back to the primary language field by field.

## 4. Security

### Row Level Security

Enabled on every table.

| Table | Owner access | Public access |
|---|---|---|
| `restaurants` | All operations where `owner_id = auth.uid()` | None |
| `menus`, `template_extras` | All operations where the menu belongs to the caller's restaurant | None |
| `sections`, `items` | All operations where `owns_menu(menu_id)` is true (items resolve through their section) | None |
| `templates` | Read | Read |
| `slug_holds`, `rate_limits` | None | None |

`owns_menu(menu_id)` is a `security definer`, `stable` SQL function that returns true when the menu's restaurant has `owner_id = auth.uid()`.

### Database functions

| Function | Caller | Behavior |
|---|---|---|
| `get_public_menu(slug)` | Anyone | Returns JSON with only public fields: restaurant name; the menu's languages, currency and template; the active template's extras; sections in order; and items in order with names, descriptions, price, image path and `is_available`. Returns null for an unknown slug. Menus without a confirmed slug are unreachable because they have no slug. |
| `is_slug_available(slug)` | Signed-in owners | False if the slug fails the format rule, exists in `menus`, or has a `slug_holds` row with `available_at` null or in the future. |
| `confirm_menu_slug(menu_id, slug)` | Signed-in owners | Checks ownership, format and availability, then sets `slug` and `slug_confirmed_at` only when `slug` is still null. The unique constraint resolves concurrent claims. |
| `admin_change_slug(menu_id, new_slug)` | Service role only | Support-case slug change (FR-17). Holds the old slug as `released` with `available_at = now() + 90 days`. |
| `check_rate_limit(action, max_per_minute)` | Signed-in owners | Increments the caller's counter for the current minute and returns false when over the limit. |

### Limits

| Action | Limit |
|---|---|
| Writes (any Server Action that changes data) | 30 per minute per user |
| Image uploads | 10 per minute per user |
| Slug availability checks | 20 per minute per user |

Sign-up and login rely on Supabase Auth's built-in rate limits.

### Storage

Bucket `menu-images` is publicly readable. Insert, update and delete are allowed only when the first path segment equals the caller's restaurant ID.

### Account deletion

A Server Action using the service role, in this order: if the menu has a confirmed slug, insert it into `slug_holds` as `released` with `available_at = now() + 90 days`, delete the `menu-images/<restaurant_id>/` folder, delete the auth user. Cascades remove the restaurant and everything under it. A scheduled job is not needed for release: `is_slug_available` compares `available_at` with the current time.

### Secrets

- `.env.local` holds all keys and is git-ignored. `.env.example` lists the variable names without values.
- `SUPABASE_SERVICE_ROLE_KEY` is read only in `server-only` modules.

## 5. Testing

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | Slug rules, zod schemas, language fallback, price and currency formatting, template-extras schemas, and a check that every top-level folder in `src/app/` appears in the reserved-slug seed list |
| Database and security | Vitest against the Supabase test project | Owner A cannot read or change owner B's restaurant, menu, sections, items, extras or images; confirmed slugs cannot change; duplicate, reserved and held slugs are refused; `get_public_menu` returns only public fields; rate limits trigger |
| End to end | Playwright (added in piece 4) | Sign up, build a menu, confirm the slug, open the public page at a phone viewport in Arabic and English |

Migrations are SQL files in `supabase/migrations/`, applied with `npx supabase db push`. The schema is never edited by hand in the dashboard.

## 6. Build order

Each piece gets its own implementation plan and ends with working, tested software.

1. **Foundation.** Next.js app, environment setup, all migrations (full schema, Row Level Security, database functions, seed rows for `templates` and reserved slugs), sign-up, login, protected dashboard shell, account deletion, and the database and security test suite.
2. **Menu editor.** Create the restaurant and menu (language, currency, template); add, edit, delete and reorder sections and items; image upload; availability toggle.
3. **Link and QR code.** Slug picker with live availability check, confirmation screen stating the slug is final (FR-14), QR code download as PNG and SVG.
4. **Public menu and templates.** Template visual design pass, `/[slug]` with ISR, the `classic` and `modern` templates, template switching with preserved extras, RTL and LTR layout, language switch, Playwright test.

## 7. Out of scope for v1

Unchanged from the requirements: payments and pricing plans, custom domains, online ordering, a mobile app, analytics, more than two templates. Also out of scope: an admin UI (admin tasks run through the Supabase dashboard), item-level template fields, draft states, and multiple restaurants or menus per account.
