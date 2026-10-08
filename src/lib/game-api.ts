import type { CreateGameInput, Game, GameStatus, Round } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const OWNER_STORAGE_KEY = "yazboz.owner.v1";

function getOwnerTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OWNER_STORAGE_KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function saveOwnerToken(gameId: string, token: string): void {
  localStorage.setItem(
    OWNER_STORAGE_KEY,
    JSON.stringify({ ...getOwnerTokens(), [gameId]: token }),
  );
}

export function getOwnerToken(gameId: string): string | null {
  return getOwnerTokens()[gameId] ?? null;
}

export async function createGame(input: CreateGameInput): Promise<Game> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase ayarları henüz yapılmamış.");

  const ownerToken = crypto.randomUUID() + crypto.randomUUID();
  const players = input.playerNames.map((name) => ({
    id: crypto.randomUUID(),
    name: name.trim(),
  }));

  const { data, error } = await supabase.rpc("create_game", {
    p_game_type: input.gameType,
    p_play_mode: input.playMode,
    p_players: players,
    p_owner_token: ownerToken,
  });
  if (error) throw error;

  const gameId = data as string;
  saveOwnerToken(gameId, ownerToken);
  const game = await getGame(gameId);
  if (!game) throw new Error("Masa oluşturuldu ancak veriler alınamadı.");
  return game;
}

export async function getGame(gameId: string): Promise<Game | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase ayarları henüz yapılmamış.");

  const { data, error } = await supabase.rpc("get_public_game", {
    p_game_id: gameId,
  });
  if (error) throw error;
  return data as Game | null;
}

export async function saveGame(
  game: Game,
  status: GameStatus = game.status,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const ownerToken = getOwnerToken(game.id);
  if (!supabase || !ownerToken) throw new Error("Bu masa için yazma yetkiniz yok.");

  const { error } = await supabase.rpc("save_game", {
    p_game_id: game.id,
    p_owner_token: ownerToken,
    p_players: game.players,
    p_rounds: game.rounds,
    p_status: status,
  });
  if (error) throw error;
}

export async function deleteGame(gameId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const ownerToken = getOwnerToken(gameId);
  if (!supabase || !ownerToken) throw new Error("Bu masa için yazma yetkiniz yok.");

  const { error } = await supabase.rpc("delete_game", {
    p_game_id: gameId,
    p_owner_token: ownerToken,
  });
  if (error) throw error;
  const ownerTokens = getOwnerTokens();
  delete ownerTokens[gameId];
  localStorage.setItem(OWNER_STORAGE_KEY, JSON.stringify(ownerTokens));
}

export function updateRound(
  rounds: Round[],
  nextRound: Round,
): Round[] {
  const exists = rounds.some((round) => round.id === nextRound.id);
  return exists
    ? rounds.map((round) => (round.id === nextRound.id ? nextRound : round))
    : [...rounds, nextRound];
}
