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
