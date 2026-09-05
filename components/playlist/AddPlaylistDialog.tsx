"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { SourceForm } from "@/components/playlist/SourceForm";
import { useUiStore } from "@/lib/store/uiStore";

export { formatExpiry } from "@/components/playlist/SourceForm";

/**
 * İçerik ekleme modalı.
 *
 * Mobilde alttan açılan bir sayfa (bottom sheet), masaüstünde ortalanmış diyalog.
 * Form içeriği ana sayfadaki panelle ortak: `SourceForm`.
 */
export function AddPlaylistDialog() {
  const open = useUiStore((state) => state.playlistDialogOpen);
  const close = useUiStore((state) => state.closePlaylistDialog);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    // Arkadaki sayfa kaydırılmasın (mobilde sheet açıkken belirgin bir sorundu).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Kapat"
        onClick={close}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-dialog-title"
        className="animate-fade-up relative flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-850 shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/6 p-5 sm:p-6">
          <div>
            <h2 id="playlist-dialog-title" className="text-[19px] font-bold tracking-tight">
              İçerik Ekle
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">
              Dört giriş yolundan birini seç. İçerikler otomatik olarak film, dizi ve canlı kanallara
              ayrılır.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:p-6">
          <SourceForm onDone={close} compact />
        </div>
      </div>
    </div>
  );
}
