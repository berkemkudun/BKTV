"use client";

import { AlertCircle, CheckCircle2, FileUp, Link2, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";

type Tab = "url" | "file";

/** M3U ekleme akışı: indir → parse et → analiz et → kaydet. Her adım kullanıcıya gösterilir. */
export function AddPlaylistDialog() {
  const open = useUiStore((state) => state.playlistDialogOpen);
  const close = useUiStore((state) => state.closePlaylistDialog);
  const addFromUrl = useLibraryStore((state) => state.addFromUrl);
  const addFromText = useLibraryStore((state) => state.addFromText);
  const load = useLibraryStore((state) => state.load);
  const resetLoadState = useLibraryStore((state) => state.resetLoadState);

  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
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
              Playlist Ekle
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">
              M3U adresini yapıştır ya da dosyanı yükle. İçerikler otomatik olarak platformlara ayrılır.
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
                { id: "url" as const, label: "M3U URL", icon: Link2 },
                { id: "file" as const, label: "Dosya Yükle", icon: FileUp },
              ]
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[13.5px] font-semibold transition-colors ${
                    tab === item.id ? "bg-white/10 text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </button>
              );
            })}
          </div>

          <label className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
            Playlist adı (opsiyonel)
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Örn. Ana Liste"
            className="mb-5 h-11 w-full rounded-xl border border-white/8 bg-white/[0.04] px-3.5 text-[14px] outline-none transition-colors placeholder:text-fg-dim focus:border-accent/40"
          />

          {tab === "url" ? (
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
