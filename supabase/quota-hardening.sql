-- Existing installations: apply this after schema.sql to reject NULL limits.
-- This replaces only the function, not existing policies or usage tables.
create or replace function public.consume_chat_quota(p_user_id uuid, p_max_requests integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_used integer;
begin
  if p_user_id is null or p_max_requests is null or p_max_requests not between 1 and 100 then return false; end if;
  begin
    insert into public.chat_usage_day(user_id, day_start, used)
      values(p_user_id, (now() at time zone 'UTC')::date, 1)
    on conflict(user_id, day_start) do update set used = public.chat_usage_day.used + 1
      where public.chat_usage_day.used < 60
    returning used into v_used;
    if v_used is null then raise exception 'daily quota' using errcode='P0001'; end if;
    v_used := null;
    insert into public.chat_usage_minute(user_id, minute_start, used)
      values(p_user_id, date_trunc('minute', now()), 1)
    on conflict(user_id, minute_start) do update set used = public.chat_usage_minute.used + 1
      where public.chat_usage_minute.used < p_max_requests
    returning used into v_used;
    if v_used is null then raise exception 'minute quota' using errcode='P0001'; end if;
  exception when sqlstate 'P0001' then return false;
  end;
  return true;
end;
$$;
revoke all on function public.consume_chat_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_chat_quota(uuid, integer) to service_role;
