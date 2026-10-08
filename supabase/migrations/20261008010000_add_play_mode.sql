alter table public.games
  add column if not exists play_mode text not null default 'solo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_play_mode_check'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_play_mode_check check (play_mode in ('solo', 'teams'));
  end if;
end;
$$;

drop function if exists public.create_game(text, jsonb, text);

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

revoke execute on function public.create_game(text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.get_public_game(uuid) from public, anon, authenticated;
grant execute on function public.create_game(text, text, jsonb, text) to anon;
grant execute on function public.get_public_game(uuid) to anon;
