create or replace function public.check_rate_limit(p_action text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  next_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, current_window, 1)
  on conflict on constraint rate_limits_pkey
  do update set count = public.rate_limits.count + 1
  returning count into next_count;
  return next_count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, integer) from public;
grant execute on function public.check_rate_limit(text, integer) to authenticated;
