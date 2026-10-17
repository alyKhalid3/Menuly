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
