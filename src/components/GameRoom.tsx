"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  deleteGame,
  getGame,
  getOwnerToken,
  saveGame,
  updateRound,
} from "@/lib/game-api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Game, GameRoomProps, GameStatus, LeaderboardRow, Round, RoundEditorProps } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function RoundEditor({ players, round, busy, onCancel, onSave }: RoundEditorProps) {
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((player) => [player.id, String(round?.scores[player.id] ?? 0)])),
  );
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Object.fromEntries(
      players.map((player) => [player.id, Number(scores[player.id])]),
    );
    if (players.some((player) => !Number.isSafeInteger(parsed[player.id]))) {
      setError("Her oyuncu için tam sayı puan girin.");
      return;
    }

    onSave({
      id: round?.id ?? crypto.randomUUID(),
      createdAt: round?.createdAt ?? new Date().toISOString(),
      scores: parsed,
      kind: round?.kind ?? "round",
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="round-modal" role="dialog" aria-modal="true" aria-labelledby="round-title">
        <div className="modal-heading">
          <div><span className="step-label">EL PUANLARI</span><h2 id="round-title">{round ? "Eli düzenle" : "Yeni el"}</h2></div>
          <button className="icon-button" onClick={onCancel} aria-label="Kapat" type="button">×</button>
        </div>
        <p className="modal-help">Bu eldeki puan değişimini her oyuncu için girin. Eksi puan kullanabilirsiniz.</p>
        <form onSubmit={handleSubmit}>
          <div className="score-input-list">
            {players.map((player, index) => (
              <label className="score-input-row" key={player.id}>
                <span className={`player-number player-number-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
                <span className="score-player-name">{player.name}</span>
                <span className="score-control">
                  <span>±</span>
                  <input
                    aria-label={`${player.name} puanı`}
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={scores[player.id]}
                    onChange={(event) => setScores((current) => ({ ...current, [player.id]: event.target.value }))}
                    required
                  />
                </span>
              </label>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onCancel}>Vazgeç</button>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Puanları kaydet"}<span>↗</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function GameRoom({ gameId }: GameRoomProps) {
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingRound, setEditingRound] = useState<Round | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [connection, setConnection] = useState("Bağlanıyor");
  const [isOwner, setIsOwner] = useState(false);
  const [recordCooldowns, setRecordCooldowns] = useState<Record<string, number>>({});
  const [cooldownClock, setCooldownClock] = useState(0);
  const recordCooldownsRef = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    try {
      const freshGame = await getGame(gameId);
      if (!freshGame) {
        setLoadError("Bu masa bulunamadı. Bağlantıyı kontrol edip yeniden deneyin.");
        setGame(null);
        return;
      }
      setGame(freshGame);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Masa yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    setIsOwner(Boolean(getOwnerToken(gameId)));
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setConnection("Bağlantı ayarı gerekli");
      return;
    }

    const channel = supabase
      .channel(`game:${gameId}`, { config: { private: false } })
      .on("broadcast", { event: "game_changed" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("Canlı bağlantı açık");
          void refresh();
        }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("Yeniden bağlanıyor");
        else if (status === "CLOSED") setConnection("Bağlantı kapalı");
      });

    return () => { void supabase.removeChannel(channel); };
  }, [gameId, refresh]);

  useEffect(() => {
    if (!Object.values(recordCooldowns).some((until) => until > Date.now())) return;

    // Keep the visible countdown accurate while the ref blocks double taps synchronously.
    const interval = window.setInterval(() => {
      const now = Date.now();
      setCooldownClock(now);
      const activeCooldowns = Object.fromEntries(
        Object.entries(recordCooldownsRef.current).filter(([, until]) => until > now),
      );
      recordCooldownsRef.current = activeCooldowns;
      setRecordCooldowns(activeCooldowns);
    }, 250);

    return () => window.clearInterval(interval);
  }, [recordCooldowns]);

  const totals = useMemo<Record<string, number>>(() => {
    if (!game) return {};
    return Object.fromEntries(game.players.map((player) => [
      player.id,
      game.rounds.reduce((sum, round) => sum + (round.scores[player.id] ?? 0), 0),
    ]));
  }, [game]);

  const rankings = useMemo<LeaderboardRow[]>(() => {
    if (!game) return [];
    const rows = game.playMode === "teams"
      ? [
          { id: "team-1", players: [game.players[0], game.players[2]], total: totals[game.players[0].id] + totals[game.players[2].id] },
          { id: "team-2", players: [game.players[1], game.players[3]], total: totals[game.players[1].id] + totals[game.players[3].id] },
        ]
      : game.players.map((player) => ({ id: player.id, players: [player], total: totals[player.id] }));
    return rows.sort((a, b) => a.total - b.total);
  }, [game, totals]);

  async function persist(nextGame: Game, nextStatus: GameStatus = nextGame.status): Promise<boolean> {
    setSaving(true);
    setActionError("");
    try {
      await saveGame(nextGame, nextStatus);
      setGame({ ...nextGame, status: nextStatus, updatedAt: new Date().toISOString() });
      setEditingRound(undefined);
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Değişiklik kaydedilemedi.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleRoundSave(round: Round) {
    if (!game) return;
    await persist({ ...game, rounds: updateRound(game.rounds, round) });
  }

  async function handleRecord(playerId: string) {
    if (!game || saving) return;
    const now = Date.now();
    if ((recordCooldownsRef.current[playerId] ?? 0) > now) return;

    const until = now + 5000;
    recordCooldownsRef.current = { ...recordCooldownsRef.current, [playerId]: until };
    setCooldownClock(now);
    setRecordCooldowns(recordCooldownsRef.current);

    const record: Round = {
      id: crypto.randomUUID(),
      createdAt: new Date(now).toISOString(),
      scores: Object.fromEntries(game.players.map((player) => [player.id, player.id === playerId ? -100 : 0])),
      kind: "record",
    };
    const saved = await persist({ ...game, rounds: [...game.rounds, record] });
    if (!saved) {
      const remaining = Object.fromEntries(
        Object.entries(recordCooldownsRef.current).filter(([id]) => id !== playerId),
      );
      recordCooldownsRef.current = remaining;
      setRecordCooldowns(remaining);
    }
  }

  async function handleDeleteRound(round: Round) {
    if (!game || !window.confirm("Bu el kaydını silmek istiyor musunuz?")) return;
    await persist({ ...game, rounds: game.rounds.filter((item) => item.id !== round.id) });
  }

  async function handleFinish() {
    if (!game || !window.confirm("Masayı bitirince puanlar salt okunur olur. Devam edilsin mi?")) return;
    await persist(game, "finished");
  }

  async function handleDeleteGame() {
    if (!game || !window.confirm("Masa ve tüm el kayıtları kalıcı olarak silinsin mi?")) return;
    setSaving(true);
    try {
      await deleteGame(game.id);
      router.push("/");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Masa silinemedi.");
      setSaving(false);
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("Link kopyalanamadı. Adres çubuğundan bağlantıyı paylaşabilirsiniz.");
    }
  }

  if (loading) {
    return <main className="room-loading"><span className="brand-mark">Y</span><p>Masa hazırlanıyor…</p></main>;
  }

  if (!game) {
    return <main className="room-loading"><div className="empty-state"><span className="empty-icon">⌁</span><h1>Masa bulunamadı</h1><p>{loadError}</p><a className="primary-button link-button" href="/">Ana sayfaya dön <span>↗</span></a></div></main>;
  }

  const finished = game.status === "finished";
  const orderedRounds = [...game.rounds].reverse();
  const handCount = game.rounds.filter((round) => round.kind !== "record").length;

  return (
    <main className="room-shell">
      <header className="room-header">
        <a className="brand" href="/"><span className="brand-mark">Y</span><span>yazboz</span></a>
        <div className="room-header-actions">
          <span className={`connection-pill ${connection.includes("açık") ? "connected" : ""}`}><span className="live-dot" />{connection}</span>
          <button className="share-button" type="button" onClick={handleShare}><span>↗</span>{copied ? "Kopyalandı" : "Masayı paylaş"}</button>
        </div>
      </header>

      <div className="room-content">
        <div className="room-title-row">
          <div>
            <a className="back-link" href="/">← Yeni masa</a>
            <div className="room-title-line"><h1>{game.gameType === "101" ? "101 Okey" : "Okey"}</h1><span className={`status-badge ${finished ? "finished" : "active"}`}><span />{finished ? "Masa bitti" : "Oyun sürüyor"}</span></div>
            <p className="room-subtitle">Masa açıldı {formatDate(game.createdAt)} <span>·</span> {game.playMode === "teams" ? "Eşli oyun" : "Tekli oyun"} <span>·</span> {handCount} el oynandı</p>
          </div>
          {isOwner && !finished && <button className="finish-button" onClick={() => void handleFinish()} disabled={saving}>Oyunu bitir <span>✓</span></button>}
        </div>

        {(loadError || actionError) && <div className="error-banner" role="alert">{actionError || loadError}<button onClick={() => setActionError("")} aria-label="Uyarıyı kapat">×</button></div>}

        <section className="scoreboard-card">
          <div className="section-heading"><div><span className="step-label">GÜNCEL DURUM</span><h2>Skor tablosu</h2></div><span className="round-count">{handCount} <span>EL</span></span></div>
          <div className="scoreboard-table">
            <div className="scoreboard-head"><span>SIRA</span><span>{game.playMode === "teams" ? "TAKIMLAR" : "OYUNCU"}</span><span>TOPLAM PUAN</span></div>
            {rankings.map((player, index) => (
              <div className="scoreboard-row" key={player.id}>
                <span className={`rank-number ${index === 0 ? "rank-first" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                <span className={`rank-player ${game.playMode === "teams" ? "rank-team" : ""}`}>
                  {player.players.map((member) => {
                    const playerIndex = game.players.findIndex((item) => item.id === member.id);
                    return <span className="rank-player-member" key={member.id}>
                      <span className={`player-number player-number-${playerIndex + 1}`}>{member.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                      <strong>{member.name}</strong>
                      {isOwner && !finished && (() => {
                        const remaining = Math.max(0, (recordCooldowns[member.id] ?? 0) - cooldownClock);
                        return <button className="record-button" type="button" aria-label={`Rekor: ${member.name} için 100 puan düş`} title={`${member.name} için −100 puan kaydet`} disabled={saving || remaining > 0} onClick={() => void handleRecord(member.id)}>{remaining > 0 ? `${Math.ceil(remaining / 1000)} sn` : <><span>Rekor</span><small>−100</small></>}</button>;
                      })()}
                    </span>;
                  })}
                  {index === 0 && <span className="leader-tag">LİDER</span>}
                </span>
                <strong className={`total-score ${player.total < 0 ? "negative" : ""}`}>{player.total > 0 ? "+" : ""}{player.total}</strong>
              </div>
            ))}
          </div>
          <div className="scoreboard-foot"><span><span className="live-dot" /> Canlı güncelleniyor</span><span>Düşük puan önde</span></div>
        </section>

        <section className="rounds-section">
          <div className="section-heading rounds-heading"><div><span className="step-label">OYUN AKIŞI</span><h2>El geçmişi</h2></div>
            {isOwner && !finished && <button className="add-round-button" onClick={() => setEditingRound(null)}><span>＋</span> Yeni el ekle</button>}
          </div>

          {orderedRounds.length === 0 ? (
            <div className="empty-rounds"><span className="empty-icon">↘</span><h3>İlk el henüz yazılmadı</h3><p>Oyun başlayınca el puanlarını buradan ekleyin.</p>{isOwner && !finished && <button className="secondary-button" onClick={() => setEditingRound(null)}>İlk eli ekle <span>＋</span></button>}</div>
          ) : (
            <div className="round-list">
              {orderedRounds.map((round, index) => (
                <article className="round-card" key={round.id}>
                  <div className="round-card-heading"><div><span className={`round-number ${round.kind === "record" ? "record-round-label" : ""}`}>{round.kind === "record" ? "REKOR" : `EL ${String(handCount - orderedRounds.slice(0, index).filter((item) => item.kind !== "record").length).padStart(2, "0")}`}</span><span className="round-time">{formatDate(round.createdAt)}</span></div>
                    {isOwner && !finished && <div className="round-actions"><button onClick={() => setEditingRound(round)}>Düzenle</button><button className="delete-text" onClick={() => void handleDeleteRound(round)}>Sil</button></div>}
                  </div>
                  <div className="round-scores">
                    {game.players.map((player, playerIndex) => {
                      const score = round.scores[player.id] ?? 0;
                      return <div className="round-score" key={player.id}><span className={`player-number player-number-${playerIndex + 1}`}>{player.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span><span>{player.name}</span><strong className={score < 0 ? "negative" : score > 0 ? "positive" : ""}>{score > 0 ? "+" : ""}{score}</strong></div>;
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="room-footer">
          <span>YAZBOZ <span className="footer-dot">·</span> {game.id.slice(0, 8).toLocaleUpperCase("tr-TR")}</span>
          {isOwner ? <button onClick={() => void handleDeleteGame()} disabled={saving}>Masayı ve sonuçları sil</button> : <span>Salt okunur görünüm</span>}
        </footer>
      </div>

      {editingRound !== undefined && <RoundEditor players={game.players} round={editingRound} busy={saving} onCancel={() => setEditingRound(undefined)} onSave={(round) => void handleRoundSave(round)} />}
    </main>
  );
}
