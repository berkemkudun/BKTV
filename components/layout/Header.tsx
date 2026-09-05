"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";

const TITLES: Record<string, string> = {
  "/": "Ana Sayfa",
  "/movies": "Filmler",
  "/series": "Diziler",
  "/live": "Canlı TV",
  "/favorites": "Favorilerim",
  "/history": "Son İzlenenler",
  "/settings": "Ayarlar",
  "/search": "Arama",
};

export function Header() {
  const pathname = usePathname();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);
  const counts = useLibraryStore((state) => state.counts);

  const title = TITLES[pathname ?? "/"] ?? "";
  const total = counts.movie + counts.live + counts.sports + counts.news + counts.kids;

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-2 border-b border-white/5 bg-ink-950/85 px-3 backdrop-blur-xl sm:h-[72px] sm:gap-4 sm:px-5 lg:px-8">
      <button
        type="button"
        onClick={toggleSidebar}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-white/5 hover:text-fg lg:hidden"
        aria-label="Menüyü aç"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-bold tracking-tight sm:text-[19px]">{title}</h1>
        {pathname === "/" && total > 0 && (
          <p className="hidden text-[12.5px] text-fg-dim sm:block">
            Kütüphanende {total.toLocaleString("tr-TR")} içerik hazır
          </p>
        )}
      </div>

      <Suspense fallback={<div className="hidden h-11 w-[280px] md:block" />}>
        <HeaderSearch />
      </Suspense>

      {/* Mobilde arama kutusu yerine ayrı sayfaya götüren ikon */}
      <MobileSearchLink />

      <button
        type="button"
        onClick={openPlaylistDialog}
        className="hidden items-center gap-2 rounded-xl bg-white/5 px-3.5 py-2.5 text-[13.5px] font-semibold text-fg transition-colors hover:bg-white/10 sm:flex"
      >
        <Plus className="h-4 w-4" /> Playlist
      </button>
    </header>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  // Arama sayfasından çıkınca kutuyu temizle (render sırasında, effect'siz).
  const [trackedPath, setTrackedPath] = useState(pathname);
  if (trackedPath !== pathname) {
    setTrackedPath(pathname);
    if (pathname !== "/search" && value) setValue("");
  }

  // Arama sayfasındayken yazarken debounce'lu olarak URL'i güncelle.
  useEffect(() => {
    if (pathname !== "/search") return;
    const timer = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (current === value) return;
      router.replace(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
    }, 280);
    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
      className="relative hidden md:block"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Film, dizi veya kanal ara…"
        aria-label="Ara"
        className="h-11 w-[240px] rounded-xl border border-white/8 bg-white/[0.04] pl-10 pr-4 text-[14px] text-fg outline-none transition-all placeholder:text-fg-dim focus:w-[320px] focus:border-accent/40 focus:bg-white/[0.06] xl:w-[300px] xl:focus:w-[380px]"
      />
    </form>
  );
}

export function MobileSearchLink() {
  return (
    <Link
      href="/search"
      aria-label="Ara"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-white/5 hover:text-fg md:hidden"
    >
      <Search className="h-5 w-5" />
    </Link>
  );
}
