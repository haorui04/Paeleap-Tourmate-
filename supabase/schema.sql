-- Apply only in a NEW Supabase project intended for Paeleap chatbot.
-- This SQL is not yet applied to a live project.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists conversations_owner_time_idx
  on public.conversations (user_id, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_time_idx
  on public.messages (conversation_id, created_at desc);

create table if not exists public.chat_usage_minute (
  user_id uuid not null references auth.users(id) on delete cascade,
  minute_start timestamptz not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, minute_start)
);

create table if not exists public.chat_usage_day (
 user_id uuid not null references auth.users(id) on delete cascade,
 day_start date not null,
 used integer not null default 0 check (used >= 0),
 primary key (user_id, day_start)
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.chat_usage_minute enable row level security;
alter table public.chat_usage_day enable row level security;

-- Expose only the minimum necessary to authenticated browser clients.
revoke all on public.conversations from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.chat_usage_minute from anon, authenticated;
revoke all on public.chat_usage_day from anon, authenticated;
grant select, insert on public.conversations to authenticated;
grant select on public.messages to authenticated;
-- Deliberately NO insert/update/delete access for browser clients on messages.

create policy "read_own_conversations" on public.conversations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "create_own_conversations" on public.conversations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "read_own_messages" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

-- Called only by the privileged server AFTER verifying the user's JWT.
-- Atomic UPSERT avoids concurrency gaps in a per-minute quota.
-- Two atomic user quotas, six/minute and sixty/day (UTC). Failure rolls back both increments.
create or replace function public.consume_chat_quota(p_user_id uuid, p_max_requests integer)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_used integer;
begin
  if p_user_id is null or p_max_requests not between 1 and 100 then return false; end if;
  begin
    insert into public.chat_usage_day(user_id,day_start,used)
    values (p_user_id,(now() at time zone 'UTC')::date,1)
    on conflict (user_id,day_start) do update
      set used=public.chat_usage_day.used+1
      where public.chat_usage_day.used < 60
    returning used into v_used;
    if v_used is null then raise exception 'daily limit' using errcode='P0001'; end if;
    v_used:=null;
    insert into public.chat_usage_minute(user_id,minute_start,used)
    values (p_user_id,date_trunc('minute',now()),1)
    on conflict (user_id,minute_start) do update
      set used=public.chat_usage_minute.used+1
      where public.chat_usage_minute.used < p_max_requests
    returning used into v_used;
    if v_used is null then raise exception 'minute limit' using errcode='P0001'; end if;
  exception when sqlstate 'P0001' then return false;
  end;
  return true;
end;
$$;
revoke all on function public.consume_chat_quota(uuid,integer) from public,anon,authenticated;
grant execute on function public.consume_chat_quota(uuid,integer) to service_role;
