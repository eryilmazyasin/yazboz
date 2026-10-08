create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('okey', '101')),
  play_mode text not null default 'solo' check (play_mode in ('solo', 'teams')),
  players jsonb not null check (jsonb_typeof(players) = 'array'),
  rounds jsonb not null default '[]'::jsonb check (jsonb_typeof(rounds) = 'array'),
  status text not null default 'active' check (status in ('active', 'finished')),
  owner_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;
revoke all on table public.games from anon, authenticated;

create or replace function public.create_game(
  p_game_type text,
  p_play_mode text,
  p_players jsonb,
  p_owner_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_game_id uuid;
begin
  if p_game_type not in ('okey', '101') then
    raise exception 'Geçersiz oyun türü';
  end if;
  if p_play_mode not in ('solo', 'teams') then
    raise exception 'Geçersiz oyun düzeni';
  end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) <> 4 then
    raise exception 'Masa dört oyuncuyla başlamalı';
  end if;
  if length(coalesce(p_owner_token, '')) < 32 then
    raise exception 'Geçersiz masa sahibi anahtarı';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_players) as player(value)
    where length(trim(coalesce(value ->> 'name', ''))) = 0
       or length(trim(coalesce(value ->> 'name', ''))) > 32
  ) then
    raise exception 'Oyuncu adları 1-32 karakter olmalı';
  end if;

  insert into public.games (game_type, play_mode, players, owner_token_hash)
  values (
    p_game_type,
    p_play_mode,
    p_players,
    encode(extensions.digest(p_owner_token, 'sha256'), 'hex')
  )
  returning id into new_game_id;

  return new_game_id;
end;
$$;

create or replace function public.get_public_game(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', id,
    'gameType', game_type,
    'playMode', play_mode,
    'players', players,
    'rounds', rounds,
    'status', status,
    'createdAt', created_at,
    'updatedAt', updated_at
  )
  from public.games
  where id = p_game_id;
$$;

create or replace function public.save_game(
  p_game_id uuid,
  p_owner_token text,
  p_players jsonb,
  p_rounds jsonb,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) <> 4 then
    raise exception 'Masa dört oyuncuyla devam etmeli';
  end if;
  if jsonb_typeof(p_rounds) <> 'array' then
    raise exception 'El verisi geçersiz';
  end if;
  if p_status not in ('active', 'finished') then
    raise exception 'Geçersiz masa durumu';
  end if;

  update public.games
  set players = p_players,
      rounds = p_rounds,
      status = p_status,
      updated_at = now()
  where id = p_game_id
    and owner_token_hash = encode(extensions.digest(p_owner_token, 'sha256'), 'hex')
    and status = 'active';

  if not found then
    raise exception 'Masa bulunamadı veya yazma yetkisi geçersiz';
  end if;
end;
$$;

create or replace function public.delete_game(p_game_id uuid, p_owner_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.games
  where id = p_game_id
    and owner_token_hash = encode(extensions.digest(p_owner_token, 'sha256'), 'hex');

  if not found then
    raise exception 'Masa bulunamadı veya yazma yetkisi geçersiz';
  end if;
end;
$$;

create or replace function private.broadcast_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.id, old.id);
  perform realtime.send(
    jsonb_build_object('gameId', target_id),
    'game_changed',
    'game:' || target_id::text,
    false
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists games_broadcast_change on public.games;
create trigger games_broadcast_change
after insert or update or delete on public.games
for each row execute function private.broadcast_game_change();

revoke execute on function public.create_game(text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.get_public_game(uuid) from public, anon, authenticated;
revoke execute on function public.save_game(uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.delete_game(uuid, text) from public, anon, authenticated;
grant execute on function public.create_game(text, text, jsonb, text) to anon;
grant execute on function public.get_public_game(uuid) to anon;
grant execute on function public.save_game(uuid, text, jsonb, jsonb, text) to anon;
grant execute on function public.delete_game(uuid, text) to anon;
