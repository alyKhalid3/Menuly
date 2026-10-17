# AGENTS.md

Guidance for AI coding agents working on Menuly. Requirements live in `System-Requirement.md`; the approved v1 design (decisions, schema, security, build order) lives in `docs/superpowers/specs/2026-10-17-menuly-v1-design.md`. When they disagree, the design doc wins. This file is the short version plus the rules that must not be broken.

## What Menuly is

A SaaS where restaurant and café owners build a digital menu without a designer. The owner picks a template, adds sections, items and prices, and gets a permanent public link plus a printable QR code. Customers open the menu on their phone, with no account.

User types: **owner** (builds and edits menus), **visitor** (views the public menu), **admin** (runs the platform, handles support and custom-template requests).

## Status

Foundation is in progress. Commands:

- `npm run dev` starts the app.
- `npm test` runs unit tests.
- `npm run test:db` runs isolation tests against the Supabase project in `.env.test.local`.
- `npm run db:push` applies `supabase/migrations/` to the database in `SUPABASE_DB_URL`.
- `npm run lint` runs ESLint.

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
8. **Secrets stay out of git.** Keys go in `.env.local` (git-ignored); commit only `.env.example` with variable names and no values.

## Templates

- v1 ships exactly two templates.
- Core data (menu, sections, items) is shared by all templates. Template-specific fields live in `template_extras` (jsonb), keyed per menu and template, so switching templates and back restores them (FR-9, FR-10).
- Adding a template must not require changing core code. Templates are defined by data plus a rendering component, not by branching in shared logic.

## Public menu page

- No login required. Mobile-first.
- Arabic renders RTL and English LTR, based on the language currently shown; bilingual menus have a language switch (FR-19). Use logical CSS properties (`margin-inline-start`, etc.) rather than left/right.
- Performance target: visible content in under 2 seconds on 3G. Serve via caching (ISR or similar) and revalidate when the owner edits; do not query the database on every visit.

## Data model

Defined in section 3 of the design doc. Key points: one restaurant per account and one menu per restaurant; Arabic and English text in paired columns (`name_ar`, `name_en`, ...) with a required primary language and an optional secondary that falls back to the primary; `template_extras` keyed by `(menu_id, template_id)`; `slug_holds` for reserved route names and 90-day holds on slugs from deleted accounts. The schema changes only through SQL files in `supabase/migrations/`.

## Out of scope for v1

Payments and pricing plans, custom domains, online ordering or carts, a mobile app, analytics, more than two templates. Do not build these unless asked.

## Decisions

The requirements' open questions are resolved in section 1 of the design doc. Anything not covered there is undecided: ask rather than picking an answer silently in code.

## Agent tooling

- Cursor config lives in `.cursor/`: the `codebase-memory-mcp` MCP server (`mcp.json`), the graphify rule (`rules/graphify.mdc`) and the Superpowers plugin (`settings.json`).
- Both tools must be installed on the machine and on `PATH`: `codebase-memory-mcp` via its `install.ps1` with `--skip-config`, and graphify via `uv tool install graphifyy`.
- After editing code, run `graphify update .` to keep the graph current. `graphify-out/` is git-ignored.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
