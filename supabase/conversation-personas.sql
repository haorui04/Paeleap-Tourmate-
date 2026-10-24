-- Run AFTER schema.sql and personas-schema.sql. Test in staging first.
alter table public.conversations add column if not exists persona_id text not null default 'tourmate';
alter table public.conversations add column if not exists persona_version integer not null default 1;
alter table public.conversations drop constraint if exists conversations_persona_id_check;
alter table public.conversations add constraint conversations_persona_id_check
  check (persona_id ~ '^[a-z][a-z0-9-]{1,63}$');
alter table public.conversations drop constraint if exists conversations_persona_version_check;
alter table public.conversations add constraint conversations_persona_version_check check (persona_version > 0);

-- A browser may create its own conversation for a published public profile, but
-- cannot bind one to a made-up knowledge version or alter a binding later.
create or replace function public.check_conversation_persona()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.persona_id <> old.persona_id or new.persona_version <> old.persona_version) then
    raise exception 'Conversation persona bindings are immutable' using errcode = '42501';
  end if;
  if not (new.persona_id = 'tourmate' and new.persona_version = 1) and not exists (
    select 1 from public.persona_packages p where p.persona_id = new.persona_id and p.version = new.persona_version
  ) then
    raise exception 'Persona version not published' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.check_conversation_persona() from public, anon, authenticated;
drop trigger if exists conversation_persona_valid on public.conversations;
create trigger conversation_persona_valid before insert or update on public.conversations
  for each row execute function public.check_conversation_persona();

-- No messages are inserted with a service-role key until owner AND persona
-- version have been rechecked under the same transaction's row lock.
create or replace function public.store_persona_exchange(
  p_user_id uuid, p_conversation_id uuid, p_persona_id text, p_persona_version integer,
  p_user_message text, p_assistant_message text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_conversation public.conversations%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_conversation_id is null or p_persona_id is null or p_persona_version is null or
      p_user_message is null or p_assistant_message is null or
      char_length(p_user_message) not between 1 and 1500 or char_length(p_assistant_message) not between 1 and 6000 then
    return false;
  end if;
  select * into v_conversation from public.conversations
    where id = p_conversation_id for update;
  if not found or v_conversation.user_id <> p_user_id or
      v_conversation.persona_id <> p_persona_id or v_conversation.persona_version <> p_persona_version then
    return false;
  end if;
  insert into public.messages(conversation_id, role, content, created_at) values
    (p_conversation_id, 'user', p_user_message, v_now),
    (p_conversation_id, 'assistant', p_assistant_message, v_now + interval '1 microsecond');
  return true;
end;
$$;
revoke all on function public.store_persona_exchange(uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.store_persona_exchange(uuid, uuid, text, integer, text, text) to service_role;
grant select, update on public.conversations to service_role;
grant insert on public.messages to service_role;
