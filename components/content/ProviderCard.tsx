"use client";

import Link from "next/link";

import type { LibraryProvider } from "@/lib/types";

/**
 * Platform kartı.
 *
 * Not: Platformların gerçek logo dosyaları uygulamada paketlenmez (marka varlıkları
 * bize ait değil). Bunun yerine platformun kendi rengiyle üretilmiş bir wordmark
 * gösterilir; M3U'dan bir logo geldiyse o kullanılır.
 */
export function ProviderCard({ provider }: { provider: LibraryProvider }) {
  const parts: string[] = [];
  if (provider.movieCount) parts.push(`${provider.movieCount.toLocaleString("tr-TR")} film`);
  if (provider.seriesCount) parts.push(`${provider.seriesCount.toLocaleString("tr-TR")} dizi`);
  if (provider.liveCount) parts.push(`${provider.liveCount.toLocaleString("tr-TR")} kanal`);

  return (
    <Link
      href={`/provider/${provider.slug}`}
      className="group relative flex h-[110px] w-[220px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/8 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 focus:outline-none xl:w-[240px]"
      style={{
        background: `linear-gradient(140deg, ${provider.color}38 0%, rgba(10,10,17,0.9) 62%)`,
      }}
    >
      <div
        className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-40 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: provider.color }}
      />

      <span
        className="relative text-[19px] font-extrabold tracking-tight"
        style={{ color: provider.color === "#111827" ? "#E8E8F0" : provider.color }}
      >
        {provider.name}
      </span>

      <div className="relative">
        <p className="text-[12.5px] font-medium text-fg-muted">{parts.join(" · ") || "İçerik yok"}</p>
        <p className="mt-0.5 text-[11.5px] text-fg-dim">
          {provider.itemCount.toLocaleString("tr-TR")} toplam
        </p>
      </div>
    </Link>
  );
}
