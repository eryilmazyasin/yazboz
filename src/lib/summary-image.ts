import type { Game, LeaderboardRow } from "@/lib/types";

const IMAGE_WIDTH = 1080;
const SIDE_PADDING = 64;

function formatRoundLabel(kind: string | undefined, handNumber: number): string {
  if (kind === "record") return `REKOR · EL ${String(handNumber).padStart(2, "0")}`;
  if (kind === "penalty") return `CEZA · EL ${String(handNumber).padStart(2, "0")}`;
  return `EL ${String(handNumber).padStart(2, "0")}`;
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && context.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function canvasToFile(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Özet görseli oluşturulamadı."));
        return;
      }
      resolve(new File([blob], "yazboz-oyun-ozeti.png", { type: "image/png" }));
    }, "image/png");
  });
}

export async function createSummaryImage(game: Game, rankings: LeaderboardRow[]): Promise<File> {
  const rounds = [...game.rounds].reverse();
  const handNumbers = new Map<string, number>();
  let handNumber = 0;
  for (const round of game.rounds) {
    if (round.kind !== "record" && round.kind !== "penalty") handNumber += 1;
    handNumbers.set(round.id, Math.max(handNumber, 1));
  }

  const rowHeight = 116;
  const standingsHeight = rankings.length * 86;
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = 650 + standingsHeight + rounds.length * rowHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Bu cihazda özet görseli oluşturulamıyor.");

  context.fillStyle = "#f6f4ef";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#274d3c";
  context.fillRect(0, 0, IMAGE_WIDTH, 190);
  context.fillStyle = "#d9e5d9";
  context.font = "700 20px Arial, sans-serif";
  context.fillText("GREEN GARDEN DİJİTAL YAZBOZ", SIDE_PADDING, 54);
  context.fillStyle = "#fffefa";
  context.font = "700 42px Arial, sans-serif";
  context.fillText(`${game.gameType === "101" ? "101 Okey" : "Okey"} · Oyun Özeti`, SIDE_PADDING, 112);
  context.fillStyle = "#d9e5d9";
  context.font = "24px Arial, sans-serif";
  context.fillText(`${game.playMode === "teams" ? "Eşli oyun" : "Tekli oyun"} · ${handNumber} el`, SIDE_PADDING, 155);

  const winners = rankings.filter((row) => row.total === rankings[0]?.total);
  const winnerNames = winners.map((row) => row.players.map((player) => player.name).join(" & ")).join(" · ");
  const tied = winners.length > 1;
  const margin = tied ? 0 : (rankings[1]?.total ?? rankings[0]?.total ?? 0) - (rankings[0]?.total ?? 0);
  context.fillStyle = "#fffefa";
  context.fillRect(SIDE_PADDING, 220, IMAGE_WIDTH - SIDE_PADDING * 2, 138);
  context.fillStyle = "#858b83";
  context.font = "700 18px Arial, sans-serif";
  context.fillText(tied ? "BERABERE" : "KAZANAN", SIDE_PADDING + 28, 260);
  context.fillStyle = "#19201c";
  context.font = "700 32px Arial, sans-serif";
  context.fillText(fitText(context, winnerNames || "Sonuç yok", IMAGE_WIDTH - SIDE_PADDING * 2 - 56), SIDE_PADDING + 28, 305);
  context.fillStyle = "#315a46";
  context.font = "700 20px Arial, sans-serif";
  context.fillText(tied ? "Puanlar eşit" : `Fark: ${margin} puan`, SIDE_PADDING + 28, 339);

  let y = 415;
  context.fillStyle = "#19201c";
  context.font = "700 26px Arial, sans-serif";
  context.fillText("SON SIRALAMA", SIDE_PADDING, y);
  y += 30;
  rankings.forEach((row, index) => {
    y += 8;
    context.fillStyle = "#fffefa";
    context.fillRect(SIDE_PADDING, y, IMAGE_WIDTH - SIDE_PADDING * 2, 66);
    context.fillStyle = "#858b83";
    context.font = "700 18px Arial, sans-serif";
    context.fillText(String(index + 1).padStart(2, "0"), SIDE_PADDING + 18, y + 40);
    context.fillStyle = "#19201c";
    context.font = "600 22px Arial, sans-serif";
    context.fillText(fitText(context, row.players.map((player) => player.name).join(" & "), 620), SIDE_PADDING + 68, y + 40);
    context.textAlign = "right";
    context.fillStyle = row.total < 0 ? "#b7514b" : "#315a46";
    context.font = "700 24px Arial, sans-serif";
    context.fillText(`${row.total > 0 ? "+" : ""}${row.total}`, IMAGE_WIDTH - SIDE_PADDING - 18, y + 40);
    context.textAlign = "left";
    y += 66;
  });

  y += 26;
  context.fillStyle = "#19201c";
  context.font = "700 26px Arial, sans-serif";
  context.fillText("EL GEÇMİŞİ", SIDE_PADDING, y);
  y += 18;
  rounds.forEach((round) => {
    y += 12;
    context.fillStyle = "#fffefa";
    context.fillRect(SIDE_PADDING, y, IMAGE_WIDTH - SIDE_PADDING * 2, rowHeight - 8);
    context.fillStyle = "#315a46";
    context.font = "700 17px Arial, sans-serif";
    context.fillText(formatRoundLabel(round.kind, handNumbers.get(round.id) ?? 1), SIDE_PADDING + 18, y + 26);
    const players = game.players;
    players.forEach((player, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const cellX = SIDE_PADDING + 18 + column * 455;
      const cellY = y + 55 + row * 27;
      const score = round.scores[player.id] ?? 0;
      context.fillStyle = "#6d756c";
      context.font = "17px Arial, sans-serif";
      context.fillText(fitText(context, player.name, 280), cellX, cellY);
      context.textAlign = "right";
      context.fillStyle = score < 0 ? "#b7514b" : "#315a46";
      context.font = "700 18px Arial, sans-serif";
      context.fillText(`${score > 0 ? "+" : ""}${score}`, cellX + 410, cellY);
      context.textAlign = "left";
    });
    y += rowHeight - 8;
  });

  context.fillStyle = "#858b83";
  context.font = "16px Arial, sans-serif";
  context.fillText("Düşük puan kazanır · yazboz", SIDE_PADDING, canvas.height - 28);
  return canvasToFile(canvas);
}
