"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/lib/game-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { GameType, PlayMode } from "@/lib/types";

const initialNames = ["", "", "", ""];

function getCreateGameErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  if (/dört oyuncu|dört kişilik|oyuncu veya takım sayısı|could not find the function public\.create_game/i.test(message)) {
    return "Supabase veritabanı güncel değil. SQL Editor’da 20261008020000_support_two_team_names.sql migration’ını çalıştırıp yeniden deneyin.";
  }

  return message || "Masa oluşturulamadı. Supabase bağlantınızı kontrol edip yeniden deneyin.";
}

export default function HomePage() {
  const router = useRouter();
  const [gameType, setGameType] = useState<GameType>("101");
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [names, setNames] = useState(initialNames);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const activeNames = playMode === "teams" ? names.slice(0, 2) : names;
    if (activeNames.some((name) => !name.trim())) {
      setError(playMode === "teams" ? "İki takımın oyuncularını da yazın." : "Dört oyuncunun adını da girin.");
      return;
    }

    setBusy(true);
    try {
      const game = await createGame({ gameType, playMode, playerNames: activeNames });
      router.push(`/masa/${game.id}`);
    } catch (caught) {
      setError(getCreateGameErrorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <main className="landing-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Yazboz ana sayfa">
          <span className="brand-mark">Y</span>
          <span>yazboz</span>
        </a>
      </header>

      <section className="home-content">
        <section className="setup-card" aria-labelledby="setup-title">
          <div className="card-heading">
            <div>
              <span className="step-label">YENİ OYUN</span>
              <h2 id="setup-title">Masanı kur</h2>
            </div>
            <span className="table-number">01 <span>/ 01</span></span>
          </div>

          <form onSubmit={handleSubmit}>
            <fieldset className="game-picker" disabled={busy}>
              <legend>Oyun türü</legend>
              <label className={`game-option ${gameType === "okey" ? "selected" : ""}`}>
                <input type="radio" name="gameType" value="okey" checked={gameType === "okey"} onChange={() => setGameType("okey")} />
                <span className="game-icon okey-icon">◆</span>
                <span><strong>Okey</strong><small>Klasik masa</small></span>
                <span className="radio-indicator" />
              </label>
              <label className={`game-option ${gameType === "101" ? "selected" : ""}`}>
                <input type="radio" name="gameType" value="101" checked={gameType === "101"} onChange={() => setGameType("101")} />
                <span className="game-icon hundred-icon">101</span>
                <span><strong>101 Okey</strong><small>Seri ve çift</small></span>
                <span className="radio-indicator" />
              </label>
            </fieldset>

            <fieldset className="mode-picker" disabled={busy}>
              <legend>Oyun düzeni</legend>
              <label className={`mode-option ${playMode === "solo" ? "selected" : ""}`}>
                <input type="radio" name="playMode" value="solo" checked={playMode === "solo"} onChange={() => setPlayMode("solo")} />
                <span className="mode-icon">♟</span>
                <span><strong>Herkes tek</strong><small>4 ayrı skor</small></span>
                <span className="radio-indicator" />
              </label>
              <label className={`mode-option ${playMode === "teams" ? "selected" : ""}`}>
                <input type="radio" name="playMode" value="teams" checked={playMode === "teams"} onChange={() => setPlayMode("teams")} />
                <span className="mode-icon team-mode-icon">♟♟</span>
                <span><strong>2’şerli eşli</strong><small>2 takım skoru</small></span>
                <span className="radio-indicator" />
              </label>
            </fieldset>

            {playMode === "teams" && (
              <p className="team-pairing-note"><span>↗</span> 1. alan 1. takım, 2. alan 2. takım içindir. Her alana iki oyuncunun adını birlikte yazın; ör. Ali &amp; Ayşe. El puanı takım toplamına eklenir.</p>
            )}

            <div className="players-heading">
              <label>{playMode === "teams" ? "Takım oyuncuları" : "Oyuncular"} <span>· {playMode === "teams" ? "2 takım" : "4 kişi"}</span></label>
              <span className="players-count">♟ &nbsp; {playMode === "teams" ? "2 TAKIM" : "4 KOLTUK"}</span>
            </div>
            <div className={`player-inputs ${playMode === "teams" ? "team-player-inputs" : ""}`}>
              {(playMode === "teams" ? names.slice(0, 2) : names).map((name, index) => (
                <label className={`player-field ${playMode === "teams" ? "team-player-field" : ""}`} key={index}>
                  <span className={`player-number player-number-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
                  {playMode === "teams" && <strong className="team-player-title">{index + 1}. takım oyuncuları</strong>}
                  <input
                    aria-label={playMode === "teams" ? `${index + 1}. takım oyuncuları` : `${index + 1}. oyuncu adı`}
                    maxLength={playMode === "teams" ? 64 : 32}
                    value={name}
                    onChange={(event) => setNames((current) => current.map((value, i) => i === index ? event.target.value : value))}
                    placeholder={playMode === "teams" ? "Örn. Ali & Ayşe" : `${index + 1}. oyuncu adı`}
                    disabled={busy}
                  />
                </label>
              ))}
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            {!configured && (
              <div className="config-notice" role="status">
                <span>ⓘ</span>
                <p>Canlı masa açmak için ücretsiz Supabase projesini bağlayın. Kurulum adımları README dosyasında.</p>
              </div>
            )}
            <button className="primary-button" type="submit" disabled={!configured || busy}>
              {busy ? "Masa hazırlanıyor…" : "Masayı oluştur"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="card-footnote"><span>♧</span> Masayı açan kişi puanları girer. Diğerleri canlı izler.</p>
        </section>
      </section>
    </main>
  );
}
