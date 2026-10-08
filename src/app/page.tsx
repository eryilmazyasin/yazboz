"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/lib/game-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { GameType, PlayMode } from "@/lib/types";

const initialNames = ["Oyuncu 1", "Oyuncu 2", "Oyuncu 3", "Oyuncu 4"];

export default function HomePage() {
  const router = useRouter();
  const [gameType, setGameType] = useState<GameType>("okey");
  const [playMode, setPlayMode] = useState<PlayMode>("solo");
  const [names, setNames] = useState(initialNames);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (names.some((name) => !name.trim())) {
      setError("Dört oyuncunun adını da girin.");
      return;
    }

    setBusy(true);
    try {
      const game = await createGame({ gameType, playMode, playerNames: names });
      router.push(`/masa/${game.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Masa oluşturulamadı.");
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
        <span className="header-note">Masanın skoru, herkesin cebinde.</span>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> MASA AÇIK, PUANLAR GÜNCEL</div>
          <h1>Yazboz artık<br /><em>hep elinizin altında.</em></h1>
          <p className="hero-description">
            Okey ya da 101 masanı kur. Puanları tek yerden yaz, herkes telefonundan anlık takip etsin.
          </p>
          <div className="hero-proof">
            <span className="proof-icon">↗</span>
            <span>Hesap yok, indirme yok.<br /><strong>Bir linkle masaya katıl.</strong></span>
          </div>
        </div>

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
              <p className="team-pairing-note"><span>↗</span> İsimleri oturma sırasına göre girin: 1. ve 3. oyuncu eş, 2. ve 4. oyuncu eş olur.</p>
            )}

            <div className="players-heading">
              <label>Oyuncular <span>· 4 kişi</span></label>
              <span className="players-count">♟ &nbsp; 4 KOLTUK</span>
            </div>
            <div className="player-inputs">
              {names.map((name, index) => (
                <label className="player-field" key={index}>
                  <span className={`player-number player-number-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
                  <input
                    aria-label={`${index + 1}. oyuncu adı`}
                    maxLength={32}
                    value={name}
                    onChange={(event) => setNames((current) => current.map((value, i) => i === index ? event.target.value : value))}
                    placeholder={`${index + 1}. oyuncu adı`}
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

      <footer className="landing-footer">
        <span>YAZBOZ <span className="footer-dot">·</span> 2026</span>
        <span>MASA SENİN, YAZBOZ HAZIR.</span>
      </footer>
    </main>
  );
}
