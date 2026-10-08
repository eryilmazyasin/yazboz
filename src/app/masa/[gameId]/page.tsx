import GameRoom from "@/components/GameRoom";
import type { GamePageProps } from "@/lib/types";

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params;
  return <GameRoom gameId={gameId} />;
}
