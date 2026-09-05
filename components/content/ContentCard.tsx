"use client";

import Link from "next/link";
import { Play, Star } from "lucide-react";

import { FavoriteButton } from "@/components/content/FavoriteButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { useInView } from "@/lib/hooks/useInView";
import { useTmdbMatch } from "@/lib/hooks/useTmdb";
import type { ContentType } from "@/lib/types";

export interface ContentCardProps {
  id: string;
  title: string;
  href: string;
  type: ContentType;
  year?: number;
  /** M3U'dan gelen logo — TMDB posteri yoksa kullanılır */
  logo?: string;
  /** Alt bilgi: "4 Sezon", "Netflix", "%62" gibi */
  subtitle?: string;
  /** TMDB'de bu başlık dizi olarak mı aransın? */
  tmdbType?: "movie" | "tv";
  /** TMDB araması yapılmasın (canlı kanallar için) */
  disableTmdb?: boolean;
  /** 0-100 arası izleme yüzdesi */
  progress?: number;
  /** Grid içinde hücreyi doldur (raflarda sabit genişlik kullanılır) */
  fill?: boolean;
}

/**
 * Standart poster kartı (2:3).
 * Poster, kart görünür alana girdiğinde TMDB'den lazy olarak çekilir.
 */
export function ContentCard({
  id,
  title,
  href,
  type,
  year,
  logo,
  subtitle,
  tmdbType = "movie",
  disableTmdb = false,
  progress,
  fill = false,
}: ContentCardProps) {
  const { ref, inView } = useInView<HTMLAnchorElement>();
  const { match } = useTmdbMatch(disableTmdb ? undefined : title, {
    year,
    type: tmdbType,
    active: inView,
  });

  const poster = match?.poster ?? logo;

  return (
    <Link
      ref={ref}
      href={href}
      className={`group relative block focus:outline-none ${
        fill ? "w-full" : "w-[132px] shrink-0 sm:w-[168px] xl:w-[184px]"
      }`}
    >
      <div className="relative overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-glow)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_48px_-20px_rgba(0,0,0,1)] group-focus-visible:-translate-y-1.5">
        <SmartImage
          src={poster}
          alt={title}
          fallbackText={title}
          className="aspect-[2/3] w-full"
          fit={poster === logo && !match ? "contain" : "cover"}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30">
            <Play className="h-5 w-5 translate-x-[1px] fill-white text-white" />
          </span>
        </div>

        <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <FavoriteButton id={id} title={title} type={type} poster={match?.poster} logo={logo} />
        </div>

        {match?.rating ? (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-1 text-[11px] font-bold backdrop-blur-sm">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {match.rating.toFixed(1)}
          </span>
        ) : null}

        {typeof progress === "number" && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
            <div className="h-full bg-accent" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-[14px] font-semibold leading-tight text-fg group-hover:text-white">
          {match?.title ?? title}
        </h3>
        <p className="mt-0.5 truncate text-[12px] text-fg-dim">
          {subtitle ?? (match?.year ?? year ?? "")}
        </p>
      </div>
    </Link>
  );
}
