"use client";

import Link from "next/link";
import { MoreVertical, Play, X } from "lucide-react";
import { useState } from "react";

import { SmartImage } from "@/components/ui/SmartImage";
import { useInView } from "@/lib/hooks/useInView";
import { useTmdbMatch } from "@/lib/hooks/useTmdb";
import { useUserStore } from "@/lib/store/userStore";
import type { WatchProgress } from "@/lib/types";

/** "Devam Et" rafındaki 16:9 kart — kaldığı yerden devam eder. */
export function ProgressCard({
  progress,
  fill = false,
}: {
  progress: WatchProgress;
  /** Grid içinde hücreyi doldur (raflarda sabit genişlik kullanılır) */
  fill?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const removeProgress = useUserStore((state) => state.removeProgress);
  const [menuOpen, setMenuOpen] = useState(false);

  const { match } = useTmdbMatch(progress.poster ? undefined : progress.title, {
    type: progress.type === "series" ? "tv" : "movie",
    active: inView,
  });

  const image = match?.backdrop ?? match?.poster ?? progress.poster ?? progress.logo;

  return (
    <div ref={ref} className={`group relative ${fill ? "w-full" : "w-[268px] shrink-0"}`}>
      <Link href={`/watch/${progress.contentId}`} className="block focus:outline-none">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-white/8 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-white/20">
          <SmartImage
            src={image}
            alt={progress.title}
            fallbackText={progress.title}
            className="aspect-video w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 opacity-0 backdrop-blur-md ring-1 ring-white/30 transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 translate-x-[1px] fill-white text-white" />
          </span>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate text-[14px] font-semibold">{progress.title}</p>
            <div className="mt-1.5 flex items-center gap-2">
              {progress.episodeLabel && (
                <span className="shrink-0 text-[11.5px] font-bold text-accent">
                  {progress.episodeLabel}
                </span>
              )}
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
              </div>
              <span className="shrink-0 text-[11.5px] font-medium text-fg-muted">%{progress.percent}</span>
            </div>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Seçenekler"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/60 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {menuOpen && (
        <button
          type="button"
          onClick={() => {
            removeProgress(progress.contentId);
            setMenuOpen(false);
          }}
          className="absolute right-2 top-11 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-[13px] font-medium shadow-xl"
        >
          <X className="h-3.5 w-3.5" /> Listeden kaldır
        </button>
      )}
    </div>
  );
}
