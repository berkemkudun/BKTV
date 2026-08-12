"use client";

import { CheckCircle2, Loader2, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useState } from "react";

import { formatExpiry } from "@/components/playlist/AddPlaylistDialog";
import { useTmdbConfigured } from "@/lib/hooks/useTmdb";
import { PARSER_VERSION } from "@/lib/library/build";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useUserStore } from "@/lib/store/userStore";

export default function SettingsPage() {
  const playlists = useLibraryStore((state) => state.playlists);
  const counts = useLibraryStore((state) => state.counts);
  const seriesCount = useLibraryStore((state) => state.series.length);
  const isDemo = useLibraryStore((state) => state.isDemo);
  const refreshPlaylist = useLibraryStore((state) => state.refreshPlaylist);
  const removePlaylist = useLibraryStore((state) => state.removePlaylist);
  const refreshXtreamAccount = useLibraryStore((state) => state.refreshXtreamAccount);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);

  const player = useUserStore((state) => state.player);
  const updatePlayerSettings = useUserStore((state) => state.updatePlayerSettings);
  const tmdbEnabled = useUserStore((state) => state.tmdbEnabled);
  const setTmdbEnabled = useUserStore((state) => state.setTmdbEnabled);

  const tmdbConfigured = useTmdbConfigured();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccountRefresh = async (id: string) => {
    setAccountBusyId(id);
    setError(null);
    try {
      await refreshXtreamAccount(id);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Hesap durumu alınamadı");
    } finally {
      setAccountBusyId(null);
    }
  };

  const handleRefresh = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await refreshPlaylist(id);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Yenileme başarısız");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-5 pb-16 pt-6 lg:px-8">
      {/* Playlist yönetimi */}
      <Section
        title="Playlist Yönetimi"
        description="M3U listelerini buradan ekle, yenile ya da kaldır. Listeler ve içerikler sadece bu cihazda saklanır."
      >
        {isDemo && (
          <div className="mb-4 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-[13.5px] text-accent-300">
            Şu an demo içerik gösteriliyor. Kendi listeni eklediğinde demo veriler kaldırılır.
          </div>
        )}

        <div className="space-y-3">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{playlist.name}</p>
                <p className="truncate text-[12.5px] text-fg-dim">
                  {playlist.source === "xtream" && playlist.xtream
                    ? `${playlist.xtream.username} @ ${playlist.xtream.host}`
                    : (playlist.url ??
                      (playlist.source === "demo" ? "Yerleşik demo veri" : "Yüklenen dosya"))}
                </p>
                <p className="mt-0.5 text-[12px] text-fg-dim">
                  {playlist.itemCount.toLocaleString("tr-TR")} içerik ·{" "}
                  {new Date(playlist.lastUpdated).toLocaleString("tr-TR")}
                </p>
                {playlist.xtream && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                    <span className="text-fg-dim">
                      Abonelik:{" "}
                      <span className="font-medium text-fg">
                        {formatExpiry(playlist.xtream.expiresAt)}
                      </span>
                    </span>
                    <span className="text-fg-dim">
                      Bağlantı:{" "}
                      <span
                        className={`font-medium ${
                          playlist.xtream.maxConnections &&
                          (playlist.xtream.activeConnections ?? 0) >= playlist.xtream.maxConnections
                            ? "text-amber-300"
                            : "text-fg"
                        }`}
                      >
                        {playlist.xtream.activeConnections ?? "?"} / {playlist.xtream.maxConnections ?? "?"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAccountRefresh(playlist.id)}
                      disabled={accountBusyId === playlist.id}
                      className="text-accent transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      {accountBusyId === playlist.id ? "kontrol ediliyor…" : "durumu yenile"}
                    </button>
                  </div>
                )}

                {playlist.source !== "demo" && playlist.parserVersion !== PARSER_VERSION && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-amber-300/90">
                    Film/dizi/kanal ayrımı bu listeden sonra geliştirildi.{" "}
                    {playlist.url
                      ? "Yenile'ye basınca liste yeniden ayrıştırılır."
                      : "Dosyayı tekrar yükleyerek yeni ayrımdan yararlanabilirsin."}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {playlist.url && (
                  <button
                    type="button"
                    onClick={() => handleRefresh(playlist.id)}
                    disabled={busyId === playlist.id}
                    className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2 text-[13px] font-medium transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {busyId === playlist.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Yenile
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removePlaylist(playlist.id)}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:border-accent/30 hover:text-accent"
                >
                  <Trash2 className="h-4 w-4" /> Sil
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-[13.5px] text-accent-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={openPlaylistDialog}
          className="mt-4 flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-600"
        >
          <Plus className="h-4 w-4" /> Playlist Ekle
        </button>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Film" value={counts.movie} />
          <Stat label="Dizi" value={seriesCount} />
          <Stat label="Canlı" value={counts.live + counts.sports + counts.news} />
          <Stat label="Diğer" value={counts.kids + counts.other} />
        </dl>
      </Section>

      {/* TMDB */}
      <Section
        title="TMDB Metadata"
        description="Poster, backdrop, açıklama, puan ve oyuncu bilgileri TMDB'den alınır. API anahtarı sunucuda tutulur, tarayıcıya gönderilmez."
      >
        <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
          {tmdbConfigured === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
          ) : tmdbConfigured ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <XCircle className="h-5 w-5 text-amber-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">
              {tmdbConfigured === null
                ? "Bağlantı kontrol ediliyor…"
                : tmdbConfigured
                  ? "TMDB bağlantısı aktif"
                  : "TMDB API anahtarı tanımlı değil"}
            </p>
            {tmdbConfigured === false && (
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                Proje kökündeki <code className="rounded bg-white/8 px-1.5 py-0.5">.env.local</code>{" "}
                dosyasına <code className="rounded bg-white/8 px-1.5 py-0.5">TMDB_API_KEY=…</code> ekleyip
                sunucuyu yeniden başlat. Anahtar olmadan posterler yerine başlıktan üretilen kapaklar
                gösterilir — uygulamanın geri kalanı çalışmaya devam eder.
              </p>
            )}
          </div>
        </div>

        <Toggle
          label="TMDB eşleştirmesini kullan"
          description="Kapatırsan hiç TMDB isteği yapılmaz, sadece M3U'daki logo ve başlıklar kullanılır."
          checked={tmdbEnabled}
          onChange={setTmdbEnabled}
        />
      </Section>

      {/* Oynatıcı */}
      <Section
        title="Oynatıcı"
        description="Video oynatma davranışı. Altyazı ve ses dili seçimi oynatıcının kendi menüsünde."
      >
        <Toggle
          label="Otomatik oynat"
          description="İçerik açıldığında oynatma hemen başlar."
          checked={player.autoplay}
          onChange={(value) => updatePlayerSettings({ autoplay: value })}
        />
        <Toggle
          label="Kaldığın yerden devam et"
          description="İzleme konumu kaydedilir ve 'Devam Et' rafında gösterilir."
          checked={player.rememberPosition}
          onChange={(value) => updatePlayerSettings({ rememberPosition: value })}
        />
        <Toggle
          label="Stream proxy'sini her zaman kullan"
          description="CORS engelli kaynaklar için yayını sunucu üzerinden geçirir. Kapalıyken sadece hata alındığında önerilir."
          checked={player.useStreamProxy}
          onChange={(value) => updatePlayerSettings({ useStreamProxy: value })}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
          <div>
            <p className="text-[14.5px] font-semibold">Varsayılan kalite</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              HLS yayınlarda başlangıç seviyesi. Kaynak bu kaliteyi sunmuyorsa en yakını seçilir.
            </p>
          </div>
          <div className="flex gap-2">
            {(["auto", "1080", "720", "480"] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                onClick={() => updatePlayerSettings({ defaultQuality: quality })}
                className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                  player.defaultQuality === quality
                    ? "bg-accent text-white"
                    : "border border-white/8 bg-white/[0.04] text-fg-muted hover:text-fg"
                }`}
              >
                {quality === "auto" ? "Otomatik" : `${quality}p`}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Görünüm */}
      <Section title="Görünüm" description="Stream Hub şu an yalnızca koyu temayla gelir.">
        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
          <div>
            <p className="text-[14.5px] font-semibold">Koyu tema</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Sinematik deneyim için tasarlandı. Açık tema henüz yok.
            </p>
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1.5 text-[12.5px] font-semibold text-fg-muted">
            Varsayılan
          </span>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-[20px] font-bold tracking-tight">{title}</h2>
      <p className="mb-4 mt-1 max-w-[640px] text-[13.5px] leading-relaxed text-fg-muted">{description}</p>
      {children}
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <dt className="text-[12.5px] text-fg-dim">{label}</dt>
      <dd className="mt-0.5 text-[20px] font-bold tabular-nums">{value.toLocaleString("tr-TR")}</dd>
    </div>
  );
}
