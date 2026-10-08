export type GameType = "okey" | "101";
export type GameStatus = "active" | "finished";
export type PlayMode = "solo" | "teams";

export interface Player {
  id: string;
  name: string;
}

export interface Round {
  id: string;
  createdAt: string;
  scores: Record<string, number>;
  kind?: "round" | "record" | "penalty";
}

export interface Game {
  id: string;
  gameType: GameType;
  playMode: PlayMode;
  players: Player[];
  rounds: Round[];
  status: GameStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameInput {
  gameType: GameType;
  playMode: PlayMode;
  playerNames: string[];
}

export interface LeaderboardRow {
  id: string;
  players: Player[];
  total: number;
}

export interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

export interface RootLayoutProps {
  children: React.ReactNode;
}

export interface GameRoomProps {
  gameId: string;
}

export interface RoundEditorProps {
  players: Player[];
  round: Round | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (round: Round) => void;
}

export interface PenaltyEditorProps {
  player: Player;
  busy: boolean;
  onCancel: () => void;
  onSave: (points: number) => void;
}
