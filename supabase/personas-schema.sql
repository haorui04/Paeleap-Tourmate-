-- Run after schema.sql. NOT applied to a live project by this repository.
-- Immutable, administrator-reviewed packages. Browser roles cannot read private
-- role descriptions/knowledge or write configurations directly.
create table if not exists public.persona_packages (
  persona_id text not null check (persona_id ~ '^[a-z][a-z0-9-]{1,63}$' and persona_id <> 'tourmate'),
  version integer not null check (version > 0),
  -- Incoming compact UTF-8 JSON is still capped at 2 MiB by the server.
  -- jsonb's textual representation may add spaces, so allow 0.5 MiB overhead.
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2621440),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  primary key (persona_id, version),
  check (payload ?& array['id','version','name','venue','role','tone','greeting','scope','knowledge']),
  check (payload->>'id' = persona_id and (payload->>'version')::integer = version),
  check (payload->>'tone' in ('professional', 'warm', 'child_friendly')),
  check (jsonb_typeof(payload->'name') = 'object' and jsonb_typeof(payload->'venue') = 'object' and jsonb_typeof(payload->'role') = 'object' and jsonb_typeof(payload->'greeting') = 'object'),
  check (jsonb_typeof(payload->'scope') = 'array' and jsonb_array_length(payload->'scope') between 1 and 20),
  check (jsonb_typeof(payload->'knowledge') = 'array' and jsonb_array_length(payload->'knowledge') between 1 and 2000)
);
alter table public.persona_packages enable row level security;
revoke all on public.persona_packages from public, anon, authenticated;
grant select, insert on public.persona_packages to service_role;

create or replace view public.persona_profiles_latest with (security_invoker = true) as
  select distinct on (persona_id) persona_id, version, payload, published_at
  from public.persona_packages order by persona_id, version desc;
revoke all on public.persona_profiles_latest from public, anon, authenticated;
grant select on public.persona_profiles_latest to service_role;

create or replace function public.reject_persona_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Published persona versions are immutable' using errcode = '42501';
end;
$$;
drop trigger if exists persona_versions_immutable on public.persona_packages;
create trigger persona_versions_immutable before update or delete on public.persona_packages
  for each row execute function public.reject_persona_mutation();
revoke all on function public.reject_persona_mutation() from public, anon, authenticated;

create or replace function public.publish_persona_package(
  p_package jsonb, p_expected_previous_version integer, p_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id text := p_package->>'id';
  v_version integer := (p_package->>'version')::integer;
  v_previous integer;
begin
  if p_actor_id is null or v_id is null or v_id = 'tourmate' or
      v_id !~ '^[a-z][a-z0-9-]{1,63}$' or v_version is null or
      v_version < 1 or p_expected_previous_version is null or
      v_version <> p_expected_previous_version + 1 then
    raise exception 'Invalid persona publication' using errcode = '22023';
  end if;
  -- A transaction-scoped per-profile lock serializes competing publishers.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paeleap-persona:' || v_id, 0));
  select coalesce(max(version), 0) into v_previous
    from public.persona_packages where persona_id = v_id;
  if v_previous <> p_expected_previous_version then
    raise exception 'Persona version conflict' using errcode = '23505';
  end if;
  if v_previous = 0 then
    -- Bound the administrative catalogue, serializing first publication only.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paeleap-persona-catalogue', 0));
    if (select count(distinct persona_id) from public.persona_packages) >= 100 then
      raise exception 'Persona catalogue limit reached' using errcode = '23514';
    end if;
  end if;
  insert into public.persona_packages(persona_id, version, payload, published_by)
    values(v_id, v_version, p_package, p_actor_id);
  return p_package;
end;
$$;
revoke all on function public.publish_persona_package(jsonb, integer, uuid) from public, anon, authenticated;
grant execute on function public.publish_persona_package(jsonb, integer, uuid) to service_role;
