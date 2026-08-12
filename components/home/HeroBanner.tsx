"use client";

import Link from "next/link";
import { Info, Play, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { FavoriteButton } from "@/components/content/FavoriteButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { useTmdbMatch } from "@/lib/hooks/useTmdb";
import type { ContentItem, SeriesItem } from "@/lib/types";

export interface HeroEntry {
  id: string;
  title: string;
  year?: number;
  kind: "movie" | "series";
  detailHref: string;
  playHref: string;
  logo?: string;
  badge?: string;
  meta?: string;
}

export function toHeroEntry(item: ContentItem | SeriesItem, kind: "movie" | "series"): HeroEntry {
  if (kind === "series") {
    const series = item as SeriesItem;
    const firstEpisode = series.seasons[0]?.episodes[0];
    return {
      id: series.id,
      title: series.title,
      year: series.year,
      kind,
      detailHref: `/series/${series.id}`,
      playHref: firstEpisode ? `/watch/${firstEpisode.id}` : `/series/${series.id}`,
      logo: series.logo,
      badge: "Dizi",
      meta: `${series.seasons.length} Sezon · ${series.episodeCount} Bölüm`,
    };
  }
  const content = item as ContentItem;
  return {
    id: content.id,
    title: content.title,
    year: content.year,
    kind,
    detailHref: `/movie/${content.id}`,
    playHref: `/watch/${content.id}`,
    logo: content.logo,
    badge: content.category ?? "Film",
  };
}

export function HeroBanner({ entries }: { entries: HeroEntry[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (entries.length <= 1) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % entries.length), 9000);
    return () => clearInterval(timer);
  }, [entries.length]);

  // Liste kısaldıysa index'i render sırasında sınırla.
  const safeIndex = index < entries.length ? index : 0;
  const entry = entries[safeIndex];
  if (!entry) return null;

  return (
    <section className="px-5 pt-5 lg:px-8">
      <HeroSlide key={entry.id} entry={entry} />

      {entries.length > 1 && (
        <div className="mt-4 flex justify-center gap-2 lg:justify-start lg:pl-2">
          {entries.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(itemIndex)}
              aria-label={`${itemIndex + 1}. içeriği göster`}
              className={`h-2 rounded-full transition-all duration-300 ${
                itemIndex === safeIndex ? "w-7 bg-accent" : "w-2 bg-white/25 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroSlide({ entry }: { entry: HeroEntry }) {
  const { match } = useTmdbMatch(entry.title, {
    year: entry.year,
    type: entry.kind === "series" ? "tv" : "movie",
  });

  const backdrop = match?.backdrop ?? match?.poster ?? entry.logo;
  const overview = match?.overview;

  return (
    <div className="animate-fade-up relative h-[380px] overflow-hidden rounded-3xl border border-white/8 xl:h-[440px] 2xl:h-[500px]">
      {/* SmartImage kendi kökünde `relative` kullanır; konumlandırmayı sarmalayıcı yapar. */}
      <div className="absolute inset-0">
        <SmartImage
          src={backdrop}
          alt={entry.title}
          fallbackText={entry.title}
          className="h-full w-full"
          priority
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />

      <div className="relative flex h-full max-w-[620px] flex-col justify-end p-7 lg:p-10">
        {entry.badge && (
          <span className="mb-3 w-fit rounded-full bg-accent/15 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wider text-accent">
            {entry.badge}
          </span>
        )}

        <h2 className="text-balance text-[38px] font-extrabold leading-[1.05] tracking-tight lg:text-[52px]">
          {match?.title ?? entry.title}
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] font-medium text-fg-muted">
          {(match?.year ?? entry.year) && <span>{match?.year ?? entry.year}</span>}
          {entry.meta && <span>· {entry.meta}</span>}
          {match?.rating ? (
            <span className="flex items-center gap-1">
              · <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-fg">{match.rating.toFixed(1)}</span>
            </span>
          ) : null}
        </div>

        {overview && (
          <p className="mt-4 line-clamp-3 max-w-[520px] text-[14.5px] leading-relaxed text-fg-muted">
            {overview}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={entry.playHref}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-600 px-6 py-3.5 text-[15px] font-bold text-white shadow-[var(--shadow-accent)] transition-transform hover:scale-[1.03]"
          >
            <Play className="h-[18px] w-[18px] fill-white" /> Hemen İzle
          </Link>
          <Link
            href={entry.detailHref}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-[15px] font-semibold backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <Info className="h-[18px] w-[18px]" /> Detaylar
          </Link>
          <FavoriteButton
            id={entry.id}
            title={entry.title}
            type={entry.kind === "series" ? "series" : "movie"}
            poster={match?.poster}
            logo={entry.logo}
            variant="button"
            className="px-5 py-3.5"
          />
        </div>
      </div>
    </div>
  );
}
