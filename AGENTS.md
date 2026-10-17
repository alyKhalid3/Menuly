# AGENTS.md

Guidance for AI coding agents working on Menuly. The full spec lives in `System-Requirement.md`; this file is the short version plus the rules that must not be broken.

## What Menuly is

A SaaS where restaurant and café owners build a digital menu without a designer. The owner picks a template, adds sections, items and prices, and gets a permanent public link plus a printable QR code. Customers open the menu on their phone, with no account.

User types: **owner** (builds and edits menus), **visitor** (views the public menu), **admin** (runs the platform, handles support and custom-template requests).

## Status

Pre-code. Only the requirements document exists. There is no build, lint or test setup yet; when one is added, document the exact commands here.

## Stack

- Next.js for the frontend and server logic (Server Actions and Route Handlers).
- Supabase: Postgres, Auth and Storage.
- No separate Node.js backend in v1. Keep server logic structured so it could be split out later, but do not add one.

## Hard rules

These come from the requirements and protect real-world printed QR codes and tenant data. Do not weaken them without explicit approval.

1. **Slugs are immutable.** Once an owner confirms a menu slug, it can never change (FR-13). No update path for slugs in owner-facing code. Only an admin-only support path may change one (FR-17, proposed).
2. **Slug rules.** Lowercase English letters, digits and hyphens; globally unique; checked against a reserved-names list (`admin`, `api`, `login`, and every top-level app route). Enforce on the server and in the database, not only in the UI.
3. **Tenant isolation.** Row Level Security is enabled on every table holding owner data. An owner can read and write only their own restaurants, menus, sections, items and extras. Never use the Supabase service-role key in code reachable from the browser.
4. **Validate on the server.** Every Server Action and Route Handler validates its input. Client-side validation is a convenience only.
5. **Uploads.** Check image type and size on the server, and compress images.
6. **Abuse protection.** Rate-limit auth and write entry points.
7. **Edits never change the link.** Saving a menu updates the public page in place; the URL and QR code stay the same (FR-6).

## Templates

- v1 ships exactly two templates.
- Core data (menu, sections, items) is shared by all templates. Template-specific fields live in `template_extras` (jsonb), keyed per menu and template, so switching templates and back restores them (FR-9, FR-10).
- Adding a template must not require changing core code. Templates are defined by data plus a rendering component, not by branching in shared logic.

## Public menu page

- No login required. Mobile-first.
- Arabic menus render RTL, English menus LTR, based on the menu's language (FR-19). Use logical CSS properties (`margin-inline-start`, etc.) rather than left/right.
- Performance target: visible content in under 2 seconds on 3G. Serve via caching (ISR or similar) and revalidate when the owner edits; do not query the database on every visit.

## Data model (draft, not yet reviewed)

`restaurants`, `menus` (template, language, immutable unique slug), `sections` (ordered), `items` (name, price, description, image, order), `template_extras` (jsonb per menu and template), `templates` (definitions and extra fields). Treat this as a starting point, not a decision.

## Out of scope for v1

Payments and pricing plans, custom domains, online ordering or carts, a mobile app, analytics, more than two templates. Do not build these unless asked.

## Open questions

These are undecided. Do not pick an answer silently in code; ask, or leave a clearly isolated default.

- One fixed currency, or chosen per owner?
- Can one account own several restaurants?
- Draft and published states, or live immediately?
- What happens to the link and slug when an account is deleted or a subscription expires?
- Are item images in v1?
- One language per menu, or bilingual menus?
- Is an "item unavailable" flag needed?

## Agent tooling

- `codebase-memory-mcp` and `graphify` may be set up locally (not committed). If available, use them to explore the code once it exists; after editing code, run `graphify update .` to keep its graph current.
