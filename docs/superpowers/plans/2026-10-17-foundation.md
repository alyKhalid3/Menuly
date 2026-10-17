# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Next.js app where an owner can sign up, sign in, see a protected dashboard, and delete the account, on top of the full v1 database schema with Row Level Security proven by tests.

**Architecture:** Next.js 16 App Router talks to a hosted Supabase project through `@supabase/ssr` clients bound to the user session, so Row Level Security is the isolation boundary. `src/proxy.ts` refreshes the session and guards `/dashboard` only. Schema, policies and security functions live in SQL migrations. Account deletion uses the service-role client from a `server-only` module.

**Tech Stack:** Next.js 16.4.2, React 19.2.4, TypeScript, Tailwind CSS 4, `@supabase/supabase-js` 2.114.0, `@supabase/ssr` 0.12.7, zod 4, Vitest 4.

## Global Constraints

- Slugs are immutable once set. No owner-facing update path. Format `^[a-z0-9]+(-[a-z0-9]+)*$`, length 3 to 40.
- One restaurant per account (`restaurants.owner_id` unique). One menu per restaurant (`menus.restaurant_id` unique).
- Row Level Security on every table. The service-role key is read only inside `import 'server-only'` modules.
- Secrets go in `.env.local` and `.env.test.local`, both git-ignored. Commit `.env.example` with names and empty values.
- Dashboard keys: Project URL; the public key labeled **publishable** or **anon**; the secret key labeled **secret** or **service_role**; Database → connection string (URI, session pooler).
- Two hosted projects. `.env.local` points at development. `.env.test.local` points at the test project. Never run tests against development.
- Migrations are the only way the schema changes. Apply with `npm run db:push`.
- The official Supabase Next.js example redirects every signed-out visitor to `/login`. This app does not: only `/dashboard` is protected. `/`, `/login`, `/signup` and the future `/[slug]` stay public.
- Node.js is 22.16.0, which satisfies Next.js 16's `>=20.9.0` engine.

---

## File structure

| File | Responsibility |
|---|---|
| `src/proxy.ts` | Refresh the Supabase session; redirect signed-out visitors away from `/dashboard` |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Per-request server client using the user session |
| `src/lib/supabase/admin.ts` | Service-role client, `server-only` |
| `src/lib/env.ts` | Read and validate environment variables |
| `src/lib/slug.ts` | Pure slug format checks |
| `src/lib/reserved-slugs.ts` | Reserved slug list, shared by the app-route test and documented for the SQL seed |
| `src/lib/account.ts` | Delete an owner: hold the slug, remove images, delete the auth user |
| `src/actions/auth.ts` | Sign-up, sign-in, sign-out server actions |
| `src/actions/account.ts` | Delete-account server action |
| `src/app/(auth)/login/page.tsx`, `signup/page.tsx` | Auth forms |
| `src/app/dashboard/page.tsx` | Protected empty dashboard |
| `supabase/migrations/0001_schema.sql` | Tables, constraints, triggers |
| `supabase/migrations/0002_rls.sql` | Policies, storage bucket |
| `supabase/migrations/0003_functions.sql` | Security functions and seed rows |
| `tests/unit/` | Slug rules and reserved-route checks, no network |
| `tests/db/` | Two-owner isolation against the test project |

---

### Task 1: Scaffold the Next.js app

The repo already has files, so `create-next-app` into `.` would refuse to run. Create the app files directly.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run dev`, `npm run build`, `npm run lint`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "menuly",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run tests/unit",
    "test:db": "vitest run tests/db",
    "db:push": "supabase db push --db-url \"%SUPABASE_DB_URL%\" --include-all"
  },
  "dependencies": {
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.114.0",
    "next": "16.4.2",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "server-only": "0.0.1",
    "zod": "4.1.12"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.1.16",
    "@types/node": "22.19.1",
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.2",
    "eslint": "9.39.1",
    "eslint-config-next": "16.4.2",
    "supabase": "2.65.6",
    "tailwindcss": "4.1.16",
    "typescript": "5.9.3",
    "vitest": "4.0.8"
  }
}
```

If `npm install` reports a version does not exist, install the newest patch of that same major.minor and record the resolved version in this plan. Do not jump majors.

- [ ] **Step 2: Write the config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "graphify-out/**", "next-env.d.ts"]),
]);

export default eslintConfig;
```

- [ ] **Step 3: Write the root layout and landing page**

`src/app/globals.css`:

```css
@import "tailwindcss";

body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

`src/app/layout.tsx`:

```tsx
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
```

`src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Menuly</h1>
      <p className="mt-4 text-lg">
        Build a digital menu, get a permanent link and a QR code, and edit it any time.
      </p>
      <p className="mt-8 flex gap-4">
        <Link href="/signup">Create an account</Link>
        <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Extend `.gitignore`**

Append:

```
node_modules/
.next/
next-env.d.ts
.env
.env.*
!.env.example
```

- [ ] **Step 5: Install and verify the scaffold**

Run: `npm install`

Then: `npm run build`

Expected: build completes and lists the `/` route.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs src .gitignore
git commit -m "Scaffold the Next.js app"
```

---

### Task 2: Environment and Supabase clients

**Files:**
- Create: `.env.example`, `src/lib/env.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/proxy.ts`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Consumes: env var names below
- Produces:
  - `publicEnv(): { url: string; publishableKey: string }`
  - `serverEnv(): { url: string; publishableKey: string; secretKey: string }`
  - `createClient()` browser and server (same name, different modules)
  - `createAdminClient()` in `src/lib/supabase/admin.ts`

- [ ] **Step 1: Write the failing env test**

`tests/unit/env.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { publicEnv, serverEnv } from "../../src/lib/env";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("env", () => {
  it("rejects a missing public url", () => {
    expect(() => publicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns the public values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    expect(publicEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "publishable",
    });
  });

  it("rejects a missing secret key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    expect(() => serverEnv()).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/unit/env.test.ts`

Expected: FAIL because `src/lib/env.ts` does not exist.

- [ ] **Step 3: Implement env and clients**

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_DB_URL=
```

`SUPABASE_DB_URL` is the Postgres URI used only by `npm run db:push`. The app never reads it.

`src/lib/env.ts`:

```ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function publicEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function serverEnv() {
  return { ...publicEnv(), secretKey: required("SUPABASE_SECRET_KEY") };
}
```

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createClient() {
  const env = publicEnv();
  return createBrowserClient(env.url, env.publishableKey);
}
```

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies. src/proxy.ts refreshes the session.
        }
      },
    },
  });
}
```

`src/lib/supabase/admin.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.url, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

`src/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  if (!data?.claims && isDashboard) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirect.cookies.set(cookie),
    );
    return redirect;
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: Run the env test**

Run: `npx vitest run tests/unit/env.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Ask the user for credentials, then verify the dev server**

Stop and ask the user to create `.env.local` from `.env.example` with the **development** project values. Do not ask them to paste secrets into chat.

Run: `npm run dev`

Open `http://localhost:3000`. Expected: the landing page, with links to `/signup` and `/login` (those pages 404 until Task 8).

- [ ] **Step 6: Commit**

```bash
git add .env.example src/lib src/proxy.ts tests/unit/env.test.ts
git commit -m "Add Supabase clients and environment validation"
```

---

### Task 3: Slug rules and the reserved-name list

**Files:**
- Create: `src/lib/slug.ts`, `src/lib/reserved-slugs.ts`
- Test: `tests/unit/slug.test.ts`, `tests/unit/reserved-slugs.test.ts`

**Interfaces:**
- Produces: `isValidSlugFormat(slug: string): boolean` and `RESERVED_SLUGS: readonly string[]`

- [ ] **Step 1: Write the failing tests**

`tests/unit/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidSlugFormat } from "../../src/lib/slug";

describe("isValidSlugFormat", () => {
  it.each(["roma", "pizza-roma", "a1", "cafe-12"])("accepts %s", (slug) => {
    expect(isValidSlugFormat(slug)).toBe(true);
  });

  it.each([
    "ab",
    "A",
    "Pizza",
    "-roma",
    "roma-",
    "pizza--roma",
    "pizza_roma",
    "بيتزا",
    "a".repeat(41),
  ])("rejects %s", (slug) => {
    expect(isValidSlugFormat(slug)).toBe(false);
  });
});
```

`src/lib/reserved-slugs.ts` is created in Step 3. The test below also fails until the app routes exist, so write it now and let it fail.

`tests/unit/reserved-slugs.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "../../src/lib/reserved-slugs";

function routeSegments(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) return [];
    if (entry.startsWith("(") || entry.startsWith("[")) return routeSegments(full);
    return [entry];
  });
}

describe("reserved slugs", () => {
  it("includes every top-level app route plus the fixed reserved names", () => {
    const routes = routeSegments(path.join(process.cwd(), "src", "app"));
    for (const route of routes) expect(RESERVED_SLUGS).toContain(route);
    for (const name of ["admin", "api", "login", "auth"]) {
      expect(RESERVED_SLUGS).toContain(name);
    }
  });

  it("matches the seed in the functions migration", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "0003_functions.sql"),
      "utf8",
    );
    for (const slug of RESERVED_SLUGS) {
      expect(sql).toContain(`'${slug}'`);
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/unit/slug.test.ts tests/unit/reserved-slugs.test.ts`

Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/slug.ts`:

```ts
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && SLUG.test(slug);
}
```

`src/lib/reserved-slugs.ts`:

```ts
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "dashboard",
  "login",
  "signup",
] as const;
```

The migration test stays red until Task 6 creates `0003_functions.sql`. That is expected. `slug.test.ts` must pass now.

- [ ] **Step 4: Run the slug test**

Run: `npx vitest run tests/unit/slug.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/reserved-slugs.ts tests/unit/slug.test.ts tests/unit/reserved-slugs.test.ts
git commit -m "Add slug format rules and the reserved-name list"
```

---

### Task 4: Schema migration

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces: tables `restaurants`, `menus`, `sections`, `items`, `templates`, `template_extras`, `slug_holds`, `rate_limits`

- [ ] **Step 1: Write the migration**

```sql
create extension if not exists pgcrypto;

create table public.templates (
  id text primary key,
  is_active boolean not null default true
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  slug text unique,
  slug_confirmed_at timestamptz,
  template_id text not null references public.templates (id),
  primary_language text not null check (primary_language in ('ar', 'en')),
  secondary_language text check (secondary_language in ('ar', 'en')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (secondary_language is null or secondary_language <> primary_language),
  check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  check (slug is null or char_length(slug) between 3 and 40),
  check ((slug is null) = (slug_confirmed_at is null))
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  name_ar text,
  name_en text,
  position integer not null check (position >= 0)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  name_ar text,
  name_en text,
  description_ar text,
  description_en text,
  price numeric(10, 2) not null check (price >= 0),
  image_path text,
  is_available boolean not null default true,
  position integer not null check (position >= 0)
);

create table public.template_extras (
  menu_id uuid not null references public.menus (id) on delete cascade,
  template_id text not null references public.templates (id),
  data jsonb not null default '{}'::jsonb,
  primary key (menu_id, template_id)
);

create table public.slug_holds (
  slug text primary key,
  reason text not null check (reason in ('reserved', 'released')),
  available_at timestamptz,
  check (
    (reason = 'reserved' and available_at is null)
    or (reason = 'released' and available_at is not null)
  )
);

create table public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (user_id, action, window_start)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger menus_set_updated_at
before update on public.menus
for each row execute function public.set_updated_at();

create or replace function public.protect_menu_slug()
returns trigger
language plpgsql
as $$
begin
  if old.slug is not null and new.slug is distinct from old.slug then
    if auth.role() is distinct from 'service_role' then
      raise exception 'menu slug is immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger menus_protect_slug
before update on public.menus
for each row execute function public.protect_menu_slug();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "Add the v1 database schema"
```

Applying it waits until Task 7, when both migrations and the test project exist.

---

### Task 5: Row Level Security and storage

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Write the migration**

```sql
create or replace function public.owns_menu(p_menu_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.menus m
    join public.restaurants r on r.id = m.restaurant_id
    where m.id = p_menu_id and r.owner_id = auth.uid()
  );
$$;

revoke all on function public.owns_menu(uuid) from public;
grant execute on function public.owns_menu(uuid) to authenticated;

alter table public.restaurants enable row level security;
alter table public.menus enable row level security;
alter table public.sections enable row level security;
alter table public.items enable row level security;
alter table public.template_extras enable row level security;
alter table public.templates enable row level security;
alter table public.slug_holds enable row level security;
alter table public.rate_limits enable row level security;

create policy restaurants_owner on public.restaurants
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy menus_owner on public.menus
for all to authenticated
using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.owner_id = auth.uid()
  )
);

create policy sections_owner on public.sections
for all to authenticated
using (public.owns_menu(menu_id))
with check (public.owns_menu(menu_id));

create policy items_owner on public.items
for all to authenticated
using (
  exists (
    select 1 from public.sections s
    where s.id = section_id and public.owns_menu(s.menu_id)
  )
)
with check (
  exists (
    select 1 from public.sections s
    where s.id = section_id and public.owns_menu(s.menu_id)
  )
);

create policy extras_owner on public.template_extras
for all to authenticated
using (public.owns_menu(menu_id))
with check (public.owns_menu(menu_id));

create policy templates_read on public.templates
for select to anon, authenticated
using (is_active);

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy menu_images_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'menu-images');

create policy menu_images_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'menu-images'
  and (storage.foldername(name))[1] in (
    select r.id::text from public.restaurants r where r.owner_id = auth.uid()
  )
);

create policy menu_images_update on storage.objects
for update to authenticated
using (
  bucket_id = 'menu-images'
  and (storage.foldername(name))[1] in (
    select r.id::text from public.restaurants r where r.owner_id = auth.uid()
  )
);

create policy menu_images_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'menu-images'
  and (storage.foldername(name))[1] in (
    select r.id::text from public.restaurants r where r.owner_id = auth.uid()
  )
);
```

`slug_holds` and `rate_limits` have RLS enabled and no policies, so the Data API cannot read or write them. Security-definer functions bypass RLS.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "Enable row level security and the image bucket"
```

---

### Task 6: Security functions and seed data

**Files:**
- Create: `supabase/migrations/0003_functions.sql`

**Interfaces:**
- Produces: `get_public_menu(text)`, `is_slug_available(text)`, `confirm_menu_slug(uuid, text)`, `admin_change_slug(uuid, text)`, `check_rate_limit(text, integer)`

- [ ] **Step 1: Write the migration**

Seed every value in `RESERVED_SLUGS`. The reserved-slug unit test fails if one is missing.

```sql
insert into public.templates (id) values ('classic'), ('modern');

insert into public.slug_holds (slug, reason) values
  ('admin', 'reserved'),
  ('api', 'reserved'),
  ('auth', 'reserved'),
  ('dashboard', 'reserved'),
  ('login', 'reserved'),
  ('signup', 'reserved');

create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(p_slug) between 3 and 40
    and not exists (select 1 from public.menus where slug = p_slug)
    and not exists (
      select 1 from public.slug_holds
      where slug = p_slug
        and (available_at is null or available_at > now())
    );
$$;

create or replace function public.confirm_menu_slug(p_menu_id uuid, p_slug text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_slug_available(p_slug) then
    raise exception 'slug is not available' using errcode = '23505';
  end if;
  update public.menus
  set slug = p_slug, slug_confirmed_at = now()
  where id = p_menu_id and slug is null and public.owns_menu(p_menu_id)
  returning id into updated_id;
  if updated_id is null then
    raise exception 'menu cannot be confirmed' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_change_slug(p_menu_id uuid, p_new_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_slug text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not public.is_slug_available(p_new_slug) then
    raise exception 'slug is not available' using errcode = '23505';
  end if;
  select slug into old_slug from public.menus where id = p_menu_id;
  if old_slug is null then
    raise exception 'menu has no slug' using errcode = '42501';
  end if;
  insert into public.slug_holds (slug, reason, available_at)
  values (old_slug, 'released', now() + interval '90 days');
  update public.menus
  set slug = p_new_slug, slug_confirmed_at = now()
  where id = p_menu_id;
end;
$$;

create or replace function public.get_public_menu(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'restaurant_name', r.name,
    'slug', m.slug,
    'template_id', m.template_id,
    'primary_language', m.primary_language,
    'secondary_language', m.secondary_language,
    'currency', m.currency,
    'extras', coalesce(te.data, '{}'::jsonb),
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name_ar', s.name_ar,
          'name_en', s.name_en,
          'position', s.position,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id,
                'name_ar', i.name_ar,
                'name_en', i.name_en,
                'description_ar', i.description_ar,
                'description_en', i.description_en,
                'price', i.price,
                'image_path', i.image_path,
                'is_available', i.is_available,
                'position', i.position
              )
              order by i.position
            )
            from public.items i where i.section_id = s.id
          ), '[]'::jsonb)
        )
        order by s.position
      )
      from public.sections s where s.menu_id = m.id
    ), '[]'::jsonb)
  )
  from public.menus m
  join public.restaurants r on r.id = m.restaurant_id
  left join public.template_extras te
    on te.menu_id = m.id and te.template_id = m.template_id
  where m.slug = p_slug;
$$;

create or replace function public.check_rate_limit(p_action text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz := date_trunc('minute', now());
  next_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, window_start, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into next_count;
  return next_count <= p_max;
end;
$$;

revoke all on function public.is_slug_available(text) from public;
revoke all on function public.confirm_menu_slug(uuid, text) from public;
revoke all on function public.admin_change_slug(uuid, text) from public;
revoke all on function public.get_public_menu(text) from public;
revoke all on function public.check_rate_limit(text, integer) from public;

grant execute on function public.is_slug_available(text) to authenticated;
grant execute on function public.confirm_menu_slug(uuid, text) to authenticated;
grant execute on function public.admin_change_slug(uuid, text) to service_role;
grant execute on function public.get_public_menu(text) to anon, authenticated;
grant execute on function public.check_rate_limit(text, integer) to authenticated;
```

- [ ] **Step 2: Run the reserved-slug test**

Run: `npx vitest run tests/unit`

Expected: PASS, including the check that every reserved slug appears in `0003_functions.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_functions.sql
git commit -m "Add menu security functions and seed data"
```

---

### Task 7: Prove tenant isolation against the test project

**Files:**
- Create: `tests/db/setup.ts`, `tests/db/isolation.test.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: the three migrations applied to the test project, and `.env.test.local`

- [ ] **Step 1: Write the test**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
  },
});
```

`tests/db/setup.ts`:

```ts
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvFile(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

loadEnvFile(".env.test.local");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.test.local`);
  return value;
}

export const url = required("NEXT_PUBLIC_SUPABASE_URL");
export const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
export const secretKey = required("SUPABASE_SECRET_KEY");

export const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function userClient(accessToken: string): SupabaseClient {
  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createOwner(email: string) {
  const password = "test-password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const signedIn = await createClient(url, publishableKey).auth.signInWithPassword({
    email,
    password,
  });
  if (signedIn.error) throw signedIn.error;
  return { id: data.user.id, client: userClient(signedIn.data.session.access_token) };
}

export async function deleteOwner(id: string) {
  await admin.auth.admin.deleteUser(id);
}
```

`tests/db/isolation.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { admin, createOwner, deleteOwner } from "./setup";

const created: string[] = [];

afterEach(async () => {
  while (created.length) await deleteOwner(created.pop()!);
});

async function seedMenu(ownerId: string, slug: string | null) {
  const { data: restaurant, error } = await admin
    .from("restaurants")
    .insert({ owner_id: ownerId, name: "Roma" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: menu, error: menuError } = await admin
    .from("menus")
    .insert({
      restaurant_id: restaurant.id,
      template_id: "classic",
      primary_language: "ar",
      currency: "EGP",
      slug,
      slug_confirmed_at: slug ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (menuError) throw menuError;
  return { restaurantId: restaurant.id, menuId: menu.id };
}

describe("tenant isolation", () => {
  it("hides one owner's menu from another owner", async () => {
    const a = await createOwner(`a-${randomUUID()}@example.com`);
    const b = await createOwner(`b-${randomUUID()}@example.com`);
    created.push(a.id, b.id);
    const { menuId } = await seedMenu(a.id, null);

    const { data } = await b.client.from("menus").select("id").eq("id", menuId);
    expect(data).toEqual([]);

    const update = await b.client.from("menus").update({ currency: "USD" }).eq("id", menuId);
    expect(update.error).toBeNull();
    const { data: unchanged } = await admin.from("menus").select("currency").eq("id", menuId).single();
    expect(unchanged?.currency).toBe("EGP");
  });

  it("refuses a second change to a confirmed slug", async () => {
    const a = await createOwner(`slug-${randomUUID()}@example.com`);
    created.push(a.id);
    const slug = `roma-${randomUUID().slice(0, 8)}`;
    const { menuId } = await seedMenu(a.id, slug);
    const change = await a.client.from("menus").update({ slug: "other-name" }).eq("id", menuId);
    expect(change.error).not.toBeNull();
  });

  it("refuses a reserved slug and exposes only public fields", async () => {
    const a = await createOwner(`pub-${randomUUID()}@example.com`);
    created.push(a.id);
    const slug = `roma-${randomUUID().slice(0, 8)}`;
    const { menuId } = await seedMenu(a.id, null);
    const reserved = await a.client.rpc("confirm_menu_slug", {
      p_menu_id: menuId,
      p_slug: "admin",
    });
    expect(reserved.error).not.toBeNull();

    const confirmed = await admin
      .from("menus")
      .update({ slug, slug_confirmed_at: new Date().toISOString() })
      .eq("id", menuId);
    expect(confirmed.error).toBeNull();

    const { createClient } = await import("@supabase/supabase-js");
    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data } = await publicClient.rpc("get_public_menu", { p_slug: slug });
    expect(data.restaurant_name).toBe("Roma");
    expect(JSON.stringify(data)).not.toContain(a.id);
  });

  it("returns false once a user passes the rate limit", async () => {
    const a = await createOwner(`rate-${randomUUID()}@example.com`);
    created.push(a.id);
    const calls = [];
    for (let i = 0; i < 3; i += 1) {
      calls.push(await a.client.rpc("check_rate_limit", { p_action: "test", p_max: 2 }));
    }
    expect(calls.map((call) => call.data)).toEqual([true, true, false]);
  });
});
```

- [ ] **Step 2: Point the tests at the test project and apply the migrations**

Ask the user to fill `.env.test.local` with the **test** project's four values. Do not accept secrets in chat.

Load it in the shell, then push:

```powershell
Get-Content .env.test.local | ForEach-Object {
  if ($_ -match '^([A-Z0-9_]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
}
npm run db:push
```

Expected: all three migrations apply. If `db:push` says the remote has no migration history, that is correct for an empty project; accept the prompt's non-interactive equivalent by adding `--yes` if the CLI offers it.

Then push the same migrations to the development project by repeating the commands with `.env.local`.

- [ ] **Step 3: Run the database tests**

Run: `npm run test:db`

Expected: PASS, 4 tests. A failure that returns the other owner's row is a stop-the-line security bug, not a test to weaken.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/db
git commit -m "Prove tenant isolation against the test database"
```

---

### Task 8: Sign up, log in and log out

**Files:**
- Create: `src/actions/auth.ts`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/auth-form.tsx`
- Test: `tests/unit/auth-schema.test.ts`

**Interfaces:**
- Produces: `signUp(formData)`, `signIn(formData)`, `signOut()`

- [ ] **Step 1: Write the failing schema test**

`tests/unit/auth-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { authSchema } from "../../src/actions/auth";

describe("authSchema", () => {
  it("accepts a normal email and an 8 character password", () => {
    expect(authSchema.safeParse({ email: "owner@example.com", password: "12345678" }).success).toBe(true);
  });

  it("rejects a short password and a bad email", () => {
    expect(authSchema.safeParse({ email: "owner@example.com", password: "short" }).success).toBe(false);
    expect(authSchema.safeParse({ email: "not-an-email", password: "12345678" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run tests/unit/auth-schema.test.ts`

Expected: FAIL, `authSchema` is not exported.

- [ ] **Step 3: Implement the actions and pages**

`src/actions/auth.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const authSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

export async function signUp(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: error.message };
  if (!data.session) return { error: "Check your email to confirm the account, then log in." };
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email or password is wrong." };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

`src/app/(auth)/auth-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";

type AuthAction = (formData: FormData) => Promise<{ error: string } | void>;

export function AuthForm({ action, submitLabel }: { action: AuthAction; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => (await action(formData)) ?? null,
    null,
  );
  return (
    <form action={formAction} className="mx-auto flex max-w-sm flex-col gap-3 px-6 py-16">
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" className="block w-full border p-2" />
      </label>
      <label>
        Password
        <input name="password" type="password" required minLength={8} autoComplete="current-password" className="block w-full border p-2" />
      </label>
      {state?.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>{submitLabel}</button>
    </form>
  );
}
```

`src/app/(auth)/signup/page.tsx`:

```tsx
import { signUp } from "@/actions/auth";
import { AuthForm } from "./auth-form";

export default function SignUpPage() {
  return <AuthForm action={signUp} submitLabel="Create account" />;
}
```

`src/app/(auth)/login/page.tsx`:

```tsx
import { signIn } from "@/actions/auth";
import { AuthForm } from "./auth-form";

export default function LoginPage() {
  return <AuthForm action={signIn} submitLabel="Log in" />;
}
```

On the **development** project, turn off Authentication → Providers → Email → Confirm email, so sign-up returns a session. The test project can keep either setting: database tests create confirmed users through the admin API.

- [ ] **Step 4: Run the schema test and the app**

Run: `npx vitest run tests/unit/auth-schema.test.ts`

Expected: PASS.

Run `npm run dev`. Sign up with a real email, land on `/dashboard` (404 until Task 9; reaching the redirect is enough here), then log out is Task 9.

- [ ] **Step 5: Commit**

```bash
git add src/actions/auth.ts src/app tests/unit/auth-schema.test.ts
git commit -m "Add sign up and log in"
```

---

### Task 9: Protected dashboard shell

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx` is unchanged

**Interfaces:**
- Consumes: `signOut`, `createClient` from `src/lib/supabase/server.ts`

- [ ] **Step 1: Write the dashboard**

`src/app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const email = data.claims.email as string | undefined;

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Your menu</h1>
      <p className="mt-2">Signed in as {email}</p>
      <p className="mt-6">You have not created a menu yet.</p>
      <form action={signOut} className="mt-8">
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

With `npm run dev` and the dev project:

1. Visit `http://localhost:3000/dashboard` while signed out. Expected: redirect to `/login`.
2. Sign up, then expect `/dashboard` to show the email and "You have not created a menu yet."
3. Log out. Expected: `/`, and `/dashboard` redirects to `/login` again.
4. Visit `/` while signed out. Expected: the landing page, not a redirect.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "Add the protected dashboard shell"
```

---

### Task 10: Account deletion

**Files:**
- Create: `src/lib/account.ts`, `src/actions/account.ts`
- Modify: `src/app/dashboard/page.tsx`
- Test: `tests/db/deletion.test.ts`

**Interfaces:**
- Produces: `deleteOwnerAccount(userId: string): Promise<void>` and `deleteAccount()` server action

- [ ] **Step 1: Write the failing deletion test**

`tests/db/deletion.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { deleteOwnerAccount } from "../../src/lib/account";
import { admin, createOwner } from "./setup";

describe("deleteOwnerAccount", () => {
  it("holds a confirmed slug for 90 days and removes the user", async () => {
    const owner = await createOwner(`del-${randomUUID()}@example.com`);
    const slug = `held-${randomUUID().slice(0, 8)}`;
    const { data: restaurant } = await admin
      .from("restaurants")
      .insert({ owner_id: owner.id, name: "Roma" })
      .select("id")
      .single();
    await admin.from("menus").insert({
      restaurant_id: restaurant!.id,
      template_id: "classic",
      primary_language: "en",
      currency: "EGP",
      slug,
      slug_confirmed_at: new Date().toISOString(),
    });

    await deleteOwnerAccount(owner.id);

    const { data: user } = await admin.auth.admin.getUserById(owner.id);
    expect(user.user).toBeNull();
    const { data: hold } = await admin.from("slug_holds").select("reason, available_at").eq("slug", slug).single();
    expect(hold?.reason).toBe("released");
    const availableAt = new Date(hold!.available_at).getTime();
    expect(availableAt).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);
  });
});
```

The test imports a module that uses `server-only`. Vitest must alias that package to an empty module. Add to `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", fileParallelism: false },
  resolve: { alias: { "server-only": new URL("./tests/empty.ts", import.meta.url).pathname } },
});
```

`tests/empty.ts` is an empty file. On Windows, `new URL(...).pathname` starts with a slash that breaks the path. Use this alias instead:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: { environment: "node", fileParallelism: false },
  resolve: { alias: { "server-only": path.join(root, "tests", "empty.ts") } },
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run tests/db/deletion.test.ts`

Expected: FAIL because `deleteOwnerAccount` does not exist.

- [ ] **Step 3: Implement deletion**

`src/lib/account.ts`:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteOwnerAccount(userId: string) {
  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, menus(slug)")
    .eq("owner_id", userId)
    .maybeSingle();

  const slug = (restaurant as { menus: { slug: string | null } | null } | null)?.menus?.slug;
  if (slug) {
    const availableAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("slug_holds").insert({
      slug,
      reason: "released",
      available_at: availableAt,
    });
    if (error) throw error;
  }

  if (restaurant) {
    const folder = restaurant.id as string;
    const { data: files } = await admin.storage.from("menu-images").list(folder);
    if (files && files.length > 0) {
      await admin.storage.from("menu-images").remove(files.map((file) => `${folder}/${file.name}`));
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
```

`menus` is a one-to-one embed because `menus.restaurant_id` is unique, so the response is an object. The cast above matches that.

`src/actions/account.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { deleteOwnerAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export async function deleteAccount() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  await deleteOwnerAccount(userId);
  await supabase.auth.signOut();
  redirect("/");
}
```

Add to the dashboard page, under the log-out form:

```tsx
import { deleteAccount } from "@/actions/account";

<form action={deleteAccount} className="mt-3">
  <button type="submit">Delete account</button>
</form>
```

- [ ] **Step 4: Run the deletion test**

Run: `npx vitest run tests/db/deletion.test.ts`

Expected: PASS. Then sign in on the dev server, create no menu, click Delete account, and confirm `/dashboard` redirects to `/login` and the email can sign up again.

- [ ] **Step 5: Commit**

```bash
git add src/lib/account.ts src/actions/account.ts src/app/dashboard/page.tsx tests/db/deletion.test.ts tests/empty.ts vitest.config.ts
git commit -m "Delete an account and hold its slug for 90 days"
```

---

### Task 11: Record the commands

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace the status section**

Replace the Status section with:

```md
## Status

Foundation is in progress. Commands:

- `npm run dev` starts the app.
- `npm test` runs unit tests.
- `npm run test:db` runs isolation tests against the Supabase project in `.env.test.local`.
- `npm run db:push` applies `supabase/migrations/` to the database in `SUPABASE_DB_URL`.
- `npm run lint` runs ESLint.
```

- [ ] **Step 2: Run the full local check**

Run: `npm test`

Expected: all unit tests pass.

Run: `npm run lint`

Expected: no errors.

Run: `npm run build`

Expected: routes `/`, `/login`, `/signup`, `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "Document the foundation commands"
```

---

## Self-review

Spec coverage for piece 1 (design doc sections 2, 3, 4 and 5, excluding editor, QR and public rendering, which are pieces 2 to 4):

| Requirement | Task |
|---|---|
| Next.js app, env files, no service role in the browser | 1, 2 |
| Full schema, immutability trigger, one restaurant, one menu | 4 |
| RLS, storage bucket, no direct public table access | 5 |
| `get_public_menu`, slug confirm, admin slug change, rate limit, seeds | 6 |
| Isolation tests, public-field check and rate limit on a separate project | 7 |
| Sign up, log in, protected dashboard | 8, 9 |
| Account deletion with a 90-day slug hold | 10 |
| Reserved names stay in sync with routes | 3, 6 |

Not in this plan, on purpose: menu editing, images from the UI, QR codes, `/[slug]`, the two template designs. The schema and functions they need are created here.
