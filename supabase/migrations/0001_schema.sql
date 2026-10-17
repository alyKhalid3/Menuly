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
