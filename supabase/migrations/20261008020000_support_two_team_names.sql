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
  expected_players integer;
  max_name_length integer;
begin
  if p_game_type not in ('okey', '101') then
    raise exception 'Geçersiz oyun türü';
  end if;
  if p_play_mode not in ('solo', 'teams') then
    raise exception 'Geçersiz oyun düzeni';
  end if;

  expected_players := case when p_play_mode = 'teams' then 2 else 4 end;
  max_name_length := case when p_play_mode = 'teams' then 64 else 32 end;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) <> expected_players then
    raise exception 'Masa seçilen oyun düzenine uygun oyuncu veya takım sayısıyla başlamalı';
  end if;
  if length(coalesce(p_owner_token, '')) < 32 then
    raise exception 'Geçersiz masa sahibi anahtarı';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_players) as player(value)
    where length(trim(coalesce(value ->> 'name', ''))) = 0
       or length(trim(coalesce(value ->> 'name', ''))) > max_name_length
  ) then
    raise exception 'Oyuncu veya takım adları boş bırakılamaz ve karakter sınırını aşamaz';
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
declare
  current_play_mode text;
  player_count integer;
begin
  select play_mode into current_play_mode
  from public.games
  where id = p_game_id
    and owner_token_hash = encode(extensions.digest(p_owner_token, 'sha256'), 'hex')
    and status = 'active';

  if not found then
    raise exception 'Masa bulunamadı veya yazma yetkisi geçersiz';
  end if;

  if jsonb_typeof(p_players) <> 'array' then
    raise exception 'Oyuncu veya takım verisi geçersiz';
  end if;
  player_count := jsonb_array_length(p_players);
  if (current_play_mode = 'solo' and player_count <> 4)
     or (current_play_mode = 'teams' and player_count not in (2, 4)) then
    raise exception 'Oyuncu veya takım sayısı masa düzeniyle uyuşmuyor';
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
