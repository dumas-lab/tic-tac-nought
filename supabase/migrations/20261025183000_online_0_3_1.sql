-- Tic Tac Nought 0.3.1 online schema.
-- Accounts are permanent users; guests are Supabase anonymous users.
-- All client data access goes through the RPCs at the bottom of this file.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  handle_norm text not null unique,
  is_guest boolean not null default false,
  banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_length check (char_length(handle) between 3 and 20),
  constraint profiles_handle_norm_format check (handle_norm ~ '^[a-z0-9_-]{3,20}$'),
  constraint profiles_guest_handle check (
    (is_guest and handle_norm like 'guest-%')
    or (not is_guest and handle_norm not like 'guest-%')
  )
);

create table if not exists public.saves (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  payload jsonb not null,
  device_id text,
  updated_at timestamptz not null default now(),
  constraint saves_payload_size check (pg_column_size(payload) <= 262144)
);

create table if not exists public.best_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  score bigint not null check (score >= 0 and score <= 1000000000),
  round integer not null check (round between 1 and 1000),
  board_size integer not null check (board_size between 3 and 50),
  level integer not null check (level between 1 and 1000),
  run_id text not null,
  achieved_at timestamptz not null default now(),
  hidden boolean not null default false,
  flagged boolean not null default false,
  constraint best_scores_run_id_format check (run_id ~ '^[A-Za-z0-9_-]{8,64}$')
);

create index if not exists best_scores_public_rank_idx
  on public.best_scores (score desc, achieved_at asc)
  where hidden = false;

create table if not exists public.score_submissions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id text not null,
  score bigint not null check (score >= 0 and score <= 1000000000),
  round integer not null check (round between 1 and 1000),
  board_size integer not null check (board_size between 3 and 50),
  level integer not null check (level between 1 and 1000),
  submitted_at timestamptz not null default now(),
  ip_hash text,
  accepted boolean not null default true,
  reason text,
  constraint score_submissions_run_id_format check (run_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  unique (user_id, run_id)
);

create index if not exists score_submissions_user_time_idx
  on public.score_submissions (user_id, submitted_at desc);

create table if not exists public.leaderboard_state (
  id smallint primary key default 1 check (id = 1),
  version bigint not null default 0
);

insert into public.leaderboard_state (id, version)
values (1, 0)
on conflict (id) do nothing;

create table if not exists public.registration_events (
  id bigserial primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists registration_events_time_idx
  on public.registration_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Basic triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.prevent_guest_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.is_guest
  ) then
    raise exception 'guest_saves_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists saves_prevent_guest on public.saves;
create trigger saves_prevent_guest
before insert or update on public.saves
for each row execute function public.prevent_guest_save();

create or replace function public.bump_leaderboard_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leaderboard_state
  set version = version + 1
  where id = 1;
  return null;
end;
$$;

drop trigger if exists best_scores_bump_version on public.best_scores;
create trigger best_scores_bump_version
after insert or update or delete on public.best_scores
for each statement execute function public.bump_leaderboard_version();

-- A rename, ban, or unban changes what the public board shows.
drop trigger if exists profiles_bump_version on public.profiles;
create trigger profiles_bump_version
after update of handle, handle_norm, banned on public.profiles
for each statement execute function public.bump_leaderboard_version();

-- ---------------------------------------------------------------------------
-- Auth users -> profiles
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text;
  v_norm text;
  v_is_guest boolean := coalesce(new.is_anonymous, false);
  v_attempt integer := 0;
  v_reserved text[] := array[
    'admin', 'administrator', 'mod', 'moderator', 'nought', 'system',
    'support', 'ttn', 'tic', 'tac', 'toe', 'guest', 'anonymous',
    'null', 'undefined', 'root', 'owner'
  ];
begin
  if v_is_guest then
    loop
      v_attempt := v_attempt + 1;
      v_handle := 'Guest-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      v_norm := lower(v_handle);
      begin
        insert into public.profiles (id, handle, handle_norm, is_guest)
        values (new.id, v_handle, v_norm, true);
        return new;
      exception when unique_violation then
        if v_attempt >= 5 then
          raise;
        end if;
      end;
    end loop;
  end if;

  v_handle := nullif(btrim(coalesce(new.raw_user_meta_data->>'handle', '')), '');
  if v_handle is null then
    raise exception 'handle_required' using errcode = '22023';
  end if;
  if v_handle !~ '^[A-Za-z0-9_-]{3,20}$' then
    raise exception 'invalid_handle' using errcode = '22023';
  end if;

  v_norm := lower(v_handle);
  if v_norm = any(v_reserved) or v_norm like 'guest-%' then
    raise exception 'reserved_handle' using errcode = '22023';
  end if;

  insert into public.profiles (id, handle, handle_norm, is_guest)
  values (new.id, v_handle, v_norm, false);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Ranking helpers
-- ---------------------------------------------------------------------------

create or replace function public.leaderboard_rank(p_user uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best public.best_scores%rowtype;
  v_rank bigint;
begin
  select * into v_best from public.best_scores where user_id = p_user;
  if not found or v_best.hidden or v_best.flagged then
    return null;
  end if;

  select count(*) + 1
  into v_rank
  from public.best_scores b
  join public.profiles p on p.id = b.user_id
  where not p.banned
    and not b.hidden
    and not b.flagged
    and (
      b.score > v_best.score
      or (b.score = v_best.score and b.achieved_at < v_best.achieved_at)
    );

  return v_rank;
end;
$$;

-- ---------------------------------------------------------------------------
-- Score submission
-- ---------------------------------------------------------------------------

create or replace function public.submit_score(
  p_run_id text,
  p_score bigint,
  p_round integer,
  p_board_size integer,
  p_level integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_existing public.score_submissions%rowtype;
  v_best public.best_scores%rowtype;
  v_inserted integer := 0;
  v_rank bigint;
  v_flagged boolean;
  v_daily_limit integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_missing' using errcode = '42501';
  end if;
  if v_profile.banned then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  if p_run_id is null or p_run_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'invalid_run_id' using errcode = '22023';
  end if;
  if p_score is null or p_score < 0 or p_score > 1000000000 then
    raise exception 'score_out_of_bounds' using errcode = '22023';
  end if;
  if p_round is null or p_round < 1 or p_round > 1000 then
    raise exception 'invalid_round' using errcode = '22023';
  end if;
  if p_board_size is null or p_board_size < 3 or p_board_size > 50 then
    raise exception 'invalid_board_size' using errcode = '22023';
  end if;
  if p_level is null or p_level < 1 or p_level > 1000 then
    raise exception 'invalid_level' using errcode = '22023';
  end if;
  if p_score > greatest(100000::bigint, p_round::bigint * 50000000) then
    raise exception 'score_out_of_bounds' using errcode = '22023';
  end if;

  -- Idempotent retries do not consume rate limit and return the existing result.
  select * into v_existing
  from public.score_submissions
  where user_id = v_uid and run_id = p_run_id;

  if found then
    select * into v_best from public.best_scores where user_id = v_uid;
    v_rank := public.leaderboard_rank(v_uid);
    return jsonb_build_object(
      'accepted', v_existing.accepted,
      'duplicate', true,
      'improved', v_best.run_id = p_run_id,
      'best', to_jsonb(v_best),
      'rank', v_rank,
      'flagged', v_best.flagged,
      'handle', v_profile.handle,
      'is_guest', v_profile.is_guest
    );
  end if;

  if exists (
    select 1 from public.score_submissions
    where user_id = v_uid and submitted_at > now() - interval '30 seconds'
  ) then
    raise sqlstate 'PT429' using message = 'rate_limited';
  end if;

  v_daily_limit := case when v_profile.is_guest then 10 else 100 end;
  if (
    select count(*) from public.score_submissions
    where user_id = v_uid and submitted_at > now() - interval '1 day'
  ) >= v_daily_limit then
    raise sqlstate 'PT429' using message = 'daily_limit';
  end if;

  v_flagged := p_score > 10000000 or p_score > p_round::bigint * 1000000;

  insert into public.score_submissions
    (user_id, run_id, score, round, board_size, level, accepted, reason)
  values
    (v_uid, p_run_id, p_score, p_round, p_board_size, p_level, true, null)
  on conflict (user_id, run_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.best_scores
      (user_id, score, round, board_size, level, run_id, flagged, achieved_at)
    values
      (v_uid, p_score, p_round, p_board_size, p_level, p_run_id, v_flagged, now())
    on conflict (user_id) do update
      set score = excluded.score,
          round = excluded.round,
          board_size = excluded.board_size,
          level = excluded.level,
          run_id = excluded.run_id,
          flagged = excluded.flagged,
          achieved_at = excluded.achieved_at
      where excluded.score > best_scores.score;
  end if;

  select * into v_best from public.best_scores where user_id = v_uid;
  v_rank := public.leaderboard_rank(v_uid);

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'improved', v_best.run_id = p_run_id,
    'best', to_jsonb(v_best),
    'rank', v_rank,
    'flagged', v_best.flagged,
    'handle', v_profile.handle,
    'is_guest', v_profile.is_guest
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------

create or replace function public.get_leaderboard(p_version bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version bigint;
  v_rows jsonb;
  v_me jsonb;
  v_uid uuid := auth.uid();
begin
  select version into v_version
  from public.leaderboard_state
  where id = 1;

  if p_version is not null and p_version = v_version then
    return jsonb_build_object('version', v_version, 'changed', false);
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.rank), '[]'::jsonb)
  into v_rows
  from (
    select
      row_number() over (order by b.score desc, b.achieved_at asc) as rank,
      p.handle,
      p.is_guest,
      b.score,
      b.round,
      b.board_size,
      b.level,
      b.achieved_at,
      (p.id = v_uid) as is_me
    from public.best_scores b
    join public.profiles p on p.id = b.user_id
    where not p.banned and not b.hidden and not b.flagged
    order by b.score desc, b.achieved_at asc
    limit 50
  ) t;

  if v_uid is not null then
    select to_jsonb(t) - 'user_id'
    into v_me
    from (
      select
        row_number() over (order by b.score desc, b.achieved_at asc) as rank,
        p.id as user_id,
        p.handle,
        p.is_guest,
        b.score,
        b.round,
        b.board_size,
        b.level,
        b.achieved_at,
        true as is_me
      from public.best_scores b
      join public.profiles p on p.id = b.user_id
      where not p.banned and not b.hidden and not b.flagged
    ) t
    where t.user_id = v_uid;
  end if;

  return jsonb_build_object(
    'version', v_version,
    'changed', true,
    'rows', v_rows,
    'me', v_me
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Save sync
-- ---------------------------------------------------------------------------

create or replace function public.sync_save(
  p_base_revision integer,
  p_payload jsonb,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_save public.saves%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_missing' using errcode = '42501';
  end if;
  if v_profile.is_guest then
    raise exception 'guest_saves_not_allowed' using errcode = '42501';
  end if;
  if v_profile.banned then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  if p_base_revision is null or p_base_revision < 0 then
    raise exception 'invalid_revision' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if pg_column_size(p_payload) > 262144 then
    raise exception 'payload_too_large' using errcode = '22023';
  end if;
  if p_payload->>'app' is distinct from 'tic-tac-nought' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload->'schema') <> 'number'
     or (p_payload->>'schema')::numeric <> 1 then
    raise exception 'unsupported_schema' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p_payload->'data'), '') <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p_payload->'data'->'state'), '') <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_save
  from public.saves
  where user_id = v_uid
  for update;

  if not found then
    if p_base_revision <> 0 then
      return jsonb_build_object(
        'status', 'conflict',
        'revision', 0,
        'updated_at', null
      );
    end if;

    insert into public.saves (user_id, revision, payload, device_id, updated_at)
    values (v_uid, 1, p_payload, left(p_device_id, 64), v_now);

    return jsonb_build_object(
      'status', 'ok',
      'revision', 1,
      'updated_at', v_now
    );
  end if;

  if p_base_revision <> v_save.revision then
    return jsonb_build_object(
      'status', 'conflict',
      'revision', v_save.revision,
      'updated_at', v_save.updated_at
    );
  end if;

  update public.saves
  set revision = v_save.revision + 1,
      payload = p_payload,
      device_id = left(p_device_id, 64),
      updated_at = v_now
  where user_id = v_uid;

  return jsonb_build_object(
    'status', 'ok',
    'revision', v_save.revision + 1,
    'updated_at', v_now
  );
end;
$$;

create or replace function public.get_save()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_save public.saves%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_missing' using errcode = '42501';
  end if;
  if v_profile.is_guest then
    raise exception 'guest_saves_not_allowed' using errcode = '42501';
  end if;

  select * into v_save from public.saves where user_id = v_uid;
  if not found then
    return jsonb_build_object('status', 'empty');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'revision', v_save.revision,
    'updated_at', v_save.updated_at,
    'payload', v_save.payload
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Account summary, export, health, registration limit, guest claim
-- ---------------------------------------------------------------------------

create or replace function public.get_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_best public.best_scores%rowtype;
  v_save public.saves%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_missing' using errcode = '42501';
  end if;

  select * into v_best from public.best_scores where user_id = v_uid;
  select * into v_save from public.saves where user_id = v_uid;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'handle', v_profile.handle,
      'is_guest', v_profile.is_guest,
      'banned', v_profile.banned,
      'created_at', v_profile.created_at
    ),
    'best', case when v_best.user_id is null then null else to_jsonb(v_best) end,
    'rank', public.leaderboard_rank(v_uid),
    'save', case when v_save.user_id is null then null else jsonb_build_object(
      'revision', v_save.revision,
      'updated_at', v_save.updated_at
    ) end
  );
end;
$$;

create or replace function public.export_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_best public.best_scores%rowtype;
  v_save public.saves%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_missing' using errcode = '42501';
  end if;
  select * into v_best from public.best_scores where user_id = v_uid;
  select * into v_save from public.saves where user_id = v_uid;

  return jsonb_build_object(
    'app', 'tic-tac-nought',
    'kind', 'account-export',
    'exported_at', now(),
    'profile', jsonb_build_object(
      'handle', v_profile.handle,
      'is_guest', v_profile.is_guest,
      'created_at', v_profile.created_at
    ),
    'best', case when v_best.user_id is null then null else to_jsonb(v_best) end,
    'rank', public.leaderboard_rank(v_uid),
    'save', case when v_save.user_id is null then null else jsonb_build_object(
      'revision', v_save.revision,
      'updated_at', v_save.updated_at,
      'payload', v_save.payload
    ) end
  );
end;
$$;

create or replace function public.health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', true, 'now', now());
$$;

create or replace function public.register_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_ip_hash is null or char_length(p_ip_hash) < 16 then
    raise exception 'invalid_ip_hash' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.registration_events
  where ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';

  if v_count >= 5 then
    raise sqlstate 'PT429' using message = 'rate_limited';
  end if;

  insert into public.registration_events (ip_hash) values (p_ip_hash);
  delete from public.registration_events where created_at < now() - interval '7 days';
  return true;
end;
$$;

create or replace function public.claim_guest_score(p_guest uuid, p_new uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best public.best_scores%rowtype;
  v_has_best boolean := false;
  v_transferred boolean := false;
  v_after public.best_scores%rowtype;
begin
  if p_guest is null or p_new is null or p_guest = p_new then
    raise exception 'invalid_accounts' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_guest and is_guest) then
    raise exception 'guest_not_found' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_new and not is_guest) then
    raise exception 'account_not_found' using errcode = '42501';
  end if;

  select * into v_best from public.best_scores where user_id = p_guest;
  v_has_best := found;

  if v_has_best then
    insert into public.best_scores
      (user_id, score, round, board_size, level, run_id, achieved_at, flagged, hidden)
    values
      (p_new, v_best.score, v_best.round, v_best.board_size, v_best.level,
       v_best.run_id, v_best.achieved_at, v_best.flagged, v_best.hidden)
    on conflict (user_id) do update
      set score = excluded.score,
          round = excluded.round,
          board_size = excluded.board_size,
          level = excluded.level,
          run_id = excluded.run_id,
          achieved_at = excluded.achieved_at,
          flagged = excluded.flagged,
          hidden = excluded.hidden
      where excluded.score > best_scores.score;

    select * into v_after from public.best_scores where user_id = p_new;
    v_transferred := found and v_after.run_id = v_best.run_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'transferred', v_transferred,
    'had_guest_score', v_has_best,
    'best', case when v_has_best then to_jsonb(v_after) else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.best_scores enable row level security;
alter table public.score_submissions enable row level security;
alter table public.leaderboard_state enable row level security;
alter table public.registration_events enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.saves from anon, authenticated;
revoke all on public.best_scores from anon, authenticated;
revoke all on public.score_submissions from anon, authenticated;
revoke all on public.leaderboard_state from anon, authenticated;
revoke all on public.registration_events from anon, authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_guest_save() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.bump_leaderboard_version() from public, anon, authenticated;
revoke execute on function public.leaderboard_rank(uuid) from public, anon, authenticated;
revoke execute on function public.submit_score(text, bigint, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.get_leaderboard(bigint) from public, anon, authenticated;
revoke execute on function public.sync_save(integer, jsonb, text) from public, anon, authenticated;
revoke execute on function public.get_save() from public, anon, authenticated;
revoke execute on function public.get_my_account() from public, anon, authenticated;
revoke execute on function public.export_account() from public, anon, authenticated;
revoke execute on function public.health() from public, anon, authenticated;
revoke execute on function public.register_rate_limit(text) from public, anon, authenticated;
revoke execute on function public.claim_guest_score(uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_leaderboard(bigint) to anon, authenticated;
grant execute on function public.health() to anon, authenticated;
grant execute on function public.submit_score(text, bigint, integer, integer, integer) to authenticated;
grant execute on function public.leaderboard_rank(uuid) to authenticated;
grant execute on function public.sync_save(integer, jsonb, text) to authenticated;
grant execute on function public.get_save() to authenticated;
grant execute on function public.get_my_account() to authenticated;
grant execute on function public.export_account() to authenticated;
grant execute on function public.register_rate_limit(text) to service_role;
grant execute on function public.claim_guest_score(uuid, uuid) to service_role;
