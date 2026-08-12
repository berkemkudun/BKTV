"use client";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";
import type { XtreamAccount } from "@/lib/types";

type Tab = "xtream" | "url" | "file";

/** M3U ekleme akışı: indir → parse et → analiz et → kaydet. Her adım kullanıcıya gösterilir. */
export function AddPlaylistDialog() {
  const open = useUiStore((state) => state.playlistDialogOpen);
  const close = useUiStore((state) => state.closePlaylistDialog);
  const addFromUrl = useLibraryStore((state) => state.addFromUrl);
  const addFromText = useLibraryStore((state) => state.addFromText);
  const addFromXtream = useLibraryStore((state) => state.addFromXtream);
  const load = useLibraryStore((state) => state.load);
  const resetLoadState = useLibraryStore((state) => state.resetLoadState);

  const [tab, setTab] = useState<Tab>("xtream");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [account, setAccount] = useState<XtreamAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Diyalog açıldığında lokal hatayı render sırasında sıfırla…
  const [trackedOpen, setTrackedOpen] = useState(open);
  if (trackedOpen !== open) {
    setTrackedOpen(open);
    if (open) setLocalError(null);
  }

  // …store'daki ilerleme durumunu ise effect içinde (harici sistem senkronizasyonu).
  useEffect(() => {
    if (open) resetLoadState();
  }, [open, resetLoadState]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, close]);

  if (!open) return null;

  const submitUrl = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setLocalError(null);
    try {
      await addFromUrl(url.trim(), name);
      setUrl("");
      setName("");
      setTimeout(close, 900);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Playlist eklenemedi");
    } finally {
      setBusy(false);
    }
  };

  const submitXtream = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!host.trim() || !username.trim() || !password.trim()) return;
    setBusy(true);
    setLocalError(null);
    setAccount(null);
    try {
      const result = await addFromXtream(
        { host: host.trim(), username: username.trim(), password: password.trim() },
        name,
      );
      setAccount(result);
      setPassword("");
      setName("");
      // Hesap özetini görebilsin diye biraz daha uzun bekletiyoruz.
      setTimeout(close, 2500);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Panele bağlanılamadı");
    } finally {
      setBusy(false);
    }
  };

  const submitFile = async (file: File) => {
    setBusy(true);
    setLocalError(null);
    try {
      const text = await file.text();
      if (!text.includes("#EXTINF")) {
        throw new Error("Dosyada #EXTINF kaydı bulunamadı — geçerli bir M3U dosyası değil");
      }
      await addFromText(text, name.trim() || file.name.replace(/\.(m3u8?|txt)$/i, ""));
      setName("");
      setTimeout(close, 900);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Dosya okunamadı");
    } finally {
      setBusy(false);
    }
  };

  const stageMessage =
    load.stage === "parsing"
      ? `${load.message} (${load.parsed.toLocaleString("tr-TR")} kayıt)`
      : load.message;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Kapat"
        onClick={() => !busy && close()}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-dialog-title"
        className="animate-fade-up relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/6 p-6">
          <div>
            <h2 id="playlist-dialog-title" className="text-[19px] font-bold tracking-tight">
              İçerik Ekle
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">
              Panel bilgilerinle giriş yap, M3U adresini yapıştır ya da dosyanı yükle. İçerikler otomatik
              olarak film, dizi ve kanallara ayrılır.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && close()}
            className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex gap-2 rounded-xl bg-white/[0.04] p-1">
            {(
              [
                { id: "xtream" as const, label: "Panel Girişi", icon: KeyRound },
                { id: "url" as const, label: "M3U URL", icon: Link2 },
                { id: "file" as const, label: "Dosya", icon: FileUp },
              ]
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
                    tab === item.id ? "bg-white/10 text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </button>
              );
            })}
          </div>

          <label className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
            Liste adı (opsiyonel)
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Örn. Ana Liste"
            className="mb-5 h-11 w-full rounded-xl border border-white/8 bg-white/[0.04] px-3.5 text-[14px] outline-none transition-colors placeholder:text-fg-dim focus:border-accent/40"
          />

          {tab === "xtream" ? (
            <form onSubmit={submitXtream} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
                  Sunucu adresi (DNS)
                </label>
                <input
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                  placeholder="http://ornek-sunucu.net:8080"
                  inputMode="url"
                  autoFocus
                  className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.04] px-3.5 text-[14px] outline-none transition-colors placeholder:text-fg-dim focus:border-accent/40"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
                    Kullanıcı adı
                  </label>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.04] px-3.5 text-[14px] outline-none transition-colors focus:border-accent/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">Şifre</label>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.04] px-3.5 pr-10 text-[14px] outline-none transition-colors focus:border-accent/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-fg-dim transition-colors hover:text-fg"
                      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[12px] leading-relaxed text-fg-dim">
                Bilgiler yalnızca panele bağlanmak için kullanılır ve bu cihazda saklanır; hiçbir yere
                gönderilmez. Panel destekliyorsa liste <code className="text-fg">m3u8</code> olarak istenir —
                kanallar tarayıcıda çok daha hızlı açılır.
              </p>

              {account && (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-4">
                  <p className="flex items-center gap-2 text-[13.5px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Bağlantı kuruldu
                  </p>
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
                    <dt className="text-fg-dim">Durum</dt>
                    <dd className="text-fg">
                      {account.status}
                      {account.isTrial ? " (deneme)" : ""}
                    </dd>
                    <dt className="text-fg-dim">Bitiş</dt>
                    <dd className="text-fg">{formatExpiry(account.expiresAt)}</dd>
                    <dt className="text-fg-dim">Eşzamanlı bağlantı</dt>
                    <dd className="text-fg">
                      {account.activeConnections ?? "?"} / {account.maxConnections ?? "?"}
                    </dd>
                    <dt className="text-fg-dim">Liste formatı</dt>
                    <dd className="text-fg">{account.outputFormat}</dd>
                  </dl>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !host.trim() || !username.trim() || !password.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-600 text-[15px] font-bold text-white transition-opacity disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Bağlanılıyor…" : "Bağlan ve İçerikleri Getir"}
              </button>
            </form>
          ) : tab === "url" ? (
            <form onSubmit={submitUrl}>
              <label className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">M3U adresi</label>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/playlist.m3u"
                inputMode="url"
                autoFocus
                className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.04] px-3.5 text-[14px] outline-none transition-colors placeholder:text-fg-dim focus:border-accent/40"
              />
              <p className="mt-2 text-[12px] leading-relaxed text-fg-dim">
                Liste tarayıcıdan değil, sunucu üzerinden indirilir — bu sayede CORS engeline takılmaz.
                Adresin sadece bu cihazda saklanır.
              </p>

              {/output=ts/i.test(url) && (
                <p className="mt-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-fg-muted">
                  Bu adres <code className="text-fg">output=ts</code> istiyor: kanallar ham MPEG-TS gelir ve
                  tarayıcıda daha yavaş açılır. <code className="text-fg">output=m3u8</code> yaparsan
                  sağlayıcı HLS verir, oynatma anında başlar. (Oynatıcı yine de ikisini de dener.)
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !url.trim()}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-600 text-[15px] font-bold text-white transition-opacity disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "İşleniyor…" : "Ekle ve Analiz Et"}
              </button>
            </form>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegurl"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void submitFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-fg-muted transition-colors hover:border-accent/40 hover:text-fg disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
                <span className="text-[14px] font-medium">
                  {busy ? "İşleniyor…" : ".m3u / .m3u8 dosyası seç"}
                </span>
                <span className="text-[12px] text-fg-dim">Dosya cihazından çıkmaz</span>
              </button>
            </div>
          )}

          {(busy || load.stage === "done") && stageMessage && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[13.5px]">
              {load.stage === "done" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
              )}
              <span className={load.stage === "done" ? "text-emerald-300" : "text-fg-muted"}>
                {stageMessage}
              </span>
            </div>
          )}

          {tab === "xtream" && !account && !busy && !localError && (
            <p className="mt-4 text-[12px] leading-relaxed text-fg-dim">
              Sunucu adresini bilmiyorsan sağlayıcının verdiği M3U bağlantısını da yapıştırabilirsin —
              adresin kök kısmı otomatik ayrıştırılır.
            </p>
          )}

          {(localError || load.error) && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-[13.5px] leading-relaxed text-accent-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{localError ?? load.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** "12.09.2026 (31 gün)" — abonelik bitişini hem tarih hem kalan gün olarak gösterir. */
export function formatExpiry(expiresAt: number | null): string {
  if (!expiresAt) return "Bilinmiyor";
  const date = new Date(expiresAt);
  const days = Math.round((expiresAt - Date.now()) / 86_400_000);
  const formatted = date.toLocaleDateString("tr-TR");
  if (days < 0) return `${formatted} · süresi dolmuş`;
  return `${formatted} · ${days} gün`;
}
