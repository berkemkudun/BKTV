"use client";

import Link from "next/link";
import { ChevronRight, Film, Heart, Radio, Tv } from "lucide-react";

import { useChannels } from "@/lib/hooks/useLibrarySelectors";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUserStore } from "@/lib/store/userStore";

export function QuickTiles() {
  const counts = useLibraryStore((state) => state.counts);
  const seriesCount = useLibraryStore((state) => state.series.length);
  const channelCount = useChannels().length;
  const favoriteCount = useUserStore((state) => Object.keys(state.favorites).length);

  const tiles = [
    {
      href: "/movies",
      label: "FİLMLER",
      description: counts.movie ? `${counts.movie.toLocaleString("tr-TR")} film seni bekliyor` : "Henüz film yok",
      icon: Film,
      from: "rgba(124,58,237,0.35)",
      accent: "#a78bfa",
    },
    {
      href: "/series",
      label: "DİZİLER",
      description: seriesCount ? `${seriesCount.toLocaleString("tr-TR")} dizi keşfet` : "Henüz dizi yok",
      icon: Tv,
      from: "rgba(255,45,70,0.32)",
      accent: "#ff8296",
    },
    {
      href: "/live",
      label: "CANLI TV",
      // /live sayfasıyla aynı seçici kullanılıyor ki sayılar tutarlı olsun.
      description: channelCount ? `${channelCount.toLocaleString("tr-TR")} kanal` : "Henüz kanal yok",
      icon: Radio,
      from: "rgba(37,99,235,0.32)",
      accent: "#7dd3fc",
    },
    {
      href: "/favorites",
      label: "FAVORİLERİM",
      description: favoriteCount ? `${favoriteCount} kayıtlı içerik` : "Henüz favori eklemedin",
      icon: Heart,
      from: "rgba(16,185,129,0.28)",
      accent: "#6ee7b7",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 px-5 pt-7 sm:grid-cols-2 lg:px-8 xl:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link
            key={tile.href}
            href={tile.href}
            className="group flex items-center gap-4 rounded-2xl border border-white/8 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
            style={{ background: `linear-gradient(120deg, ${tile.from}, rgba(12,12,20,0.75))` }}
          >
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/25"
              style={{ color: tile.accent }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold tracking-wide">{tile.label}</p>
              <p className="truncate text-[12.5px] text-fg-muted">{tile.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-fg-dim transition-transform group-hover:translate-x-1" />
          </Link>
        );
      })}
    </div>
  );
}
