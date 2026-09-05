"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Film, Heart, Home, Plus, Radio, Settings, Sparkles, Tv, X } from "lucide-react";

import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";

const NAV = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/movies", label: "Filmler", icon: Film },
  { href: "/series", label: "Diziler", icon: Tv },
  { href: "/live", label: "Canlı TV", icon: Radio },
  { href: "/favorites", label: "Favorilerim", icon: Heart },
  { href: "/history", label: "Son İzlenenler", icon: Clock },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);
  const playlists = useLibraryStore((state) => state.playlists);
  const isDemo = useLibraryStore((state) => state.isDemo);

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[300px] flex-col overflow-y-auto overscroll-contain border-r border-white/5 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl transition-transform duration-300 lg:w-[264px] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-7">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-600 shadow-[var(--shadow-accent)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            </span>
            <span className="text-[19px] font-extrabold tracking-tight">
              STREAM <span className="text-accent">HUB</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-fg-muted hover:bg-white/5 lg:hidden"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href) ?? false;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors ${
                  active
                    ? "bg-gradient-to-r from-accent/90 to-accent-600/70 text-white shadow-[var(--shadow-accent)]"
                    : "text-fg-muted hover:bg-white/5 hover:text-fg"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-6 my-6 h-px bg-white/5" />

        <div className="px-6">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-fg-muted">Playlistlerim</span>
            <button
              type="button"
              onClick={openPlaylistDialog}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/10"
            >
              <Plus className="h-3.5 w-3.5" /> Ekle
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {playlists.length === 0 && (
              <p className="text-[13px] leading-relaxed text-fg-dim">
                Henüz playlist yok. M3U adresini ekleyerek başla.
              </p>
            )}
            {playlists.map((playlist) => (
              <div key={playlist.id} className="surface rounded-xl px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold">{playlist.name}</span>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      playlist.error ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                    title={playlist.error ?? "Aktif"}
                  />
                </div>
                <p className="mt-0.5 text-[11.5px] text-fg-dim">
                  {playlist.itemCount.toLocaleString("tr-TR")} içerik · {formatAge(playlist.lastUpdated)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-3 p-4">
          {/*
            TMDB anahtarı yoksa burada uyarı göstermiyoruz: uygulama anahtarsız da
            tam çalışıyor ve sürekli hatırlatma sadece gürültü olurdu. Durum
            Ayarlar sayfasında görünür.
          */}
          {isDemo && (
            <div className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/12 to-violet/10 p-4">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                <Sparkles className="h-4 w-4 text-accent" /> Demo mod
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
                Şu an örnek içerik gösteriliyor. Kendi M3U listeni ekleyince gerçek kütüphanen yüklenir.
              </p>
              <button
                type="button"
                onClick={openPlaylistDialog}
                className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-600"
              >
                Playlist Ekle
              </button>
            </div>
          )}

        </div>
      </aside>
    </>
  );
}

function formatAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.round(hours / 24)} gün önce`;
}
