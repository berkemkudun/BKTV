"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Play, Star } from "lucide-react";
import { useState } from "react";

import { FavoriteButton } from "@/components/content/FavoriteButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { getProvider } from "@/lib/config/providers";
import { useSeriesItem } from "@/lib/hooks/useLibrarySelectors";
import { useTmdbConfigured, useTmdbDetails } from "@/lib/hooks/useTmdb";
import { fallbackOverview } from "@/lib/tmdb/messages";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUserStore } from "@/lib/store/userStore";

export default function SeriesDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useLibraryStore((state) => state.hydrated);
  const series = useSeriesItem(params?.id);
  const watchHistory = useUserStore((state) => state.watchHistory);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);

  const { meta, state } = useTmdbDetails(series?.title, { year: series?.year, type: "tv" });
  const tmdbConfigured = useTmdbConfigured();

  if (!hydrated) {
    return (
      <div className="px-5 pt-6 lg:px-8">
        <LoadingSkeleton className="h-[420px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!series) {
    return (
      <EmptyState
        title="Dizi bulunamadı"
        message="Bu dizi kütüphanede yok. Playlist silinmiş veya yenilenmiş olabilir."
        actionLabel="Dizilere dön"
        actionHref="/series"
      />
    );
  }

  const provider = getProvider(series.providerSlug);
  const seasonNumber = activeSeason ?? series.seasons[0]?.season ?? 1;
  const season = series.seasons.find((item) => item.season === seasonNumber) ?? series.seasons[0];

  return (
    <div className="pb-12">
      <div className="relative">
        <div className="fade-bottom relative h-[320px] w-full overflow-hidden lg:h-[420px]">
          <SmartImage
            src={meta?.backdrop ?? meta?.poster ?? series.logo}
            alt={series.title}
            fallbackText={series.title}
            className="h-full w-full"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 to-transparent" />
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="absolute left-5 top-5 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3.5 py-2 text-[13.5px] font-medium backdrop-blur-md transition-colors hover:bg-black/70 lg:left-8"
        >
          <ChevronLeft className="h-4 w-4" /> Geri
        </button>
      </div>

      <div className="relative -mt-28 px-5 lg:-mt-36 lg:px-8">
        <div className="flex flex-col gap-7 lg:flex-row">
          <div className="w-[170px] shrink-0 lg:w-[220px]">
            <SmartImage
              src={meta?.poster ?? series.logo}
              alt={series.title}
              fallbackText={series.title}
              className="aspect-[2/3] w-full rounded-2xl shadow-[var(--shadow-glow)]"
            />
          </div>

          <div className="min-w-0 flex-1 lg:pt-14">
            <h1 className="text-balance text-[30px] font-extrabold leading-tight tracking-tight lg:text-[42px]">
              {meta?.title ?? series.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-fg-muted">
              <span>
                {series.seasons.length} Sezon · {series.episodeCount} Bölüm
              </span>
              {meta?.rating ? (
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-fg">{meta.rating.toFixed(1)}</span>
                </span>
              ) : null}
              {provider && (
                <Link
                  href={`/provider/${provider.slug}`}
                  className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                  style={{ background: `${provider.color}22`, color: provider.color }}
                >
                  {provider.name}
                </Link>
              )}
            </div>

            {meta?.genres?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {meta.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[12.5px] text-fg-muted"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-5 max-w-[720px] text-[15px] leading-relaxed text-fg-muted">
              {meta?.overview ?? fallbackOverview(state, tmdbConfigured, "dizi")}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {season?.episodes[0] && (
                <Link
                  href={`/watch/${season.episodes[0].id}`}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-600 px-7 py-3.5 text-[15px] font-bold text-white shadow-[var(--shadow-accent)] transition-transform hover:scale-[1.03]"
                >
                  <Play className="h-[18px] w-[18px] fill-white" /> {seasonNumber}. Sezon 1. Bölüm
                </Link>
              )}
              <FavoriteButton
                id={series.id}
                title={series.title}
                type="series"
                poster={meta?.poster}
                logo={series.logo}
                variant="button"
              />
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12 px-5 lg:px-8">
        <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
          {series.seasons.map((item) => (
            <button
              key={item.season}
              type="button"
              onClick={() => setActiveSeason(item.season)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                item.season === seasonNumber
                  ? "bg-accent text-white"
                  : "border border-white/8 bg-white/[0.04] text-fg-muted hover:text-fg"
              }`}
            >
              {item.season}. Sezon
              <span className="ml-1.5 text-[12px] opacity-70">{item.episodes.length}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {season?.episodes.map((episode) => {
            const progress = watchHistory[episode.id];
            return (
              <Link
                key={episode.id}
                href={`/watch/${episode.id}`}
                className="group flex items-center gap-4 rounded-xl border border-white/6 bg-white/[0.02] p-3 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className="relative w-[150px] shrink-0 overflow-hidden rounded-lg">
                  <SmartImage
                    src={meta?.backdrop ?? series.logo}
                    alt={episode.title}
                    fallbackText={`${episode.episode}`}
                    className="aspect-video w-full"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="h-6 w-6 fill-white text-white" />
                  </span>
                  {progress && (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                      <span
                        className="block h-full bg-accent"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">
                    {episode.episode}. Bölüm
                    {progress && (
                      <span className="ml-2 text-[12px] font-medium text-accent">
                        %{progress.percent} izlendi
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-fg-dim">
                    S{String(episode.season).padStart(2, "0")}E{String(episode.episode).padStart(2, "0")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
