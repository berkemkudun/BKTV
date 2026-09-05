"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Clock, Layers, Play, Star } from "lucide-react";

import { ContentCard } from "@/components/content/ContentCard";
import { ContentRow } from "@/components/content/ContentRow";
import { FavoriteButton } from "@/components/content/FavoriteButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { useTmdbConfigured, useTmdbDetails } from "@/lib/hooks/useTmdb";
import { fallbackOverview } from "@/lib/tmdb/messages";
import { useContentItem, useMovies } from "@/lib/hooks/useLibrarySelectors";
import { getProvider } from "@/lib/config/providers";
import { useLibraryStore } from "@/lib/store/libraryStore";

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useLibraryStore((state) => state.hydrated);
  const item = useContentItem(params?.id);
  const allMovies = useMovies();

  const { meta, state } = useTmdbDetails(item?.title, { year: item?.year, type: "movie" });
  const tmdbConfigured = useTmdbConfigured();

  if (!hydrated) {
    return (
      <div className="px-4 sm:px-5 pt-6 lg:px-8">
        <LoadingSkeleton className="h-[420px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!item) {
    return (
      <EmptyState
        title="İçerik bulunamadı"
        message="Bu içerik kütüphanede yok. Playlist silinmiş veya yenilenmiş olabilir."
        actionLabel="Filmlere dön"
        actionHref="/movies"
      />
    );
  }

  const provider = getProvider(item.providerSlug);
  const similarFromLibrary = allMovies
    .filter(
      (candidate) =>
        candidate.id !== item.id &&
        (candidate.category === item.category || candidate.providerSlug === item.providerSlug),
    )
    .slice(0, 20);

  return (
    <div className="pb-12">
      <div className="relative">
        <div className="fade-bottom relative h-[340px] w-full overflow-hidden lg:h-[460px]">
          <SmartImage
            src={meta?.backdrop ?? meta?.poster ?? item.logo}
            alt={item.title}
            fallbackText={item.title}
            className="h-full w-full"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />
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

      <div className="relative -mt-32 px-4 sm:px-5 lg:-mt-40 lg:px-8">
        <div className="flex flex-col gap-7 lg:flex-row">
          <div className="w-[140px] shrink-0 sm:w-[180px] lg:w-[240px]">
            <SmartImage
              src={meta?.poster ?? item.logo}
              alt={item.title}
              fallbackText={item.title}
              className="aspect-[2/3] w-full rounded-2xl shadow-[var(--shadow-glow)]"
            />
          </div>

          <div className="min-w-0 flex-1 lg:pt-16">
            <h1 className="text-balance text-[24px] font-extrabold leading-tight tracking-tight sm:text-[32px] lg:text-[44px]">
              {meta?.title ?? item.title}
            </h1>
            {meta?.originalTitle && meta.originalTitle !== meta.title && (
              <p className="mt-1 text-[14px] text-fg-dim">{meta.originalTitle}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-fg-muted">
              {(meta?.year ?? item.year) && <span>{meta?.year ?? item.year}</span>}
              {meta?.rating ? (
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-fg">{meta.rating.toFixed(1)}</span>
                </span>
              ) : null}
              {meta?.runtime ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {formatRuntime(meta.runtime)}
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
              {meta?.overview ?? fallbackOverview(state, tmdbConfigured, "film")}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/watch/${item.id}`}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-600 px-7 py-3.5 text-[15px] font-bold text-white shadow-[var(--shadow-accent)] transition-transform hover:scale-[1.03]"
              >
                <Play className="h-[18px] w-[18px] fill-white" /> Oynat
              </Link>
              <FavoriteButton
                id={item.id}
                title={item.title}
                type="movie"
                poster={meta?.poster}
                logo={item.logo}
                variant="button"
              />
            </div>

            {item.sources && item.sources.length > 1 && (
              <div className="mt-6">
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-fg-muted">
                  <Layers className="h-4 w-4" /> {item.sources.length} farklı kaynak bulundu
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.sources.map((source, index) => (
                    <Link
                      key={source.url}
                      href={`/watch/${item.id}?source=${index}`}
                      className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2 text-[13px] font-medium transition-colors hover:bg-white/[0.08]"
                    >
                      {source.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {meta?.cast?.length ? (
        <section className="mt-12">
          <h2 className="px-4 sm:px-5 text-[19px] font-bold tracking-tight lg:px-8">Oyuncular</h2>
          <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto px-4 sm:px-5 pb-2 lg:px-8">
            {meta.cast.map((person) => (
              <div key={`${person.name}-${person.character}`} className="w-[120px] shrink-0">
                <SmartImage
                  src={person.photo}
                  alt={person.name}
                  fallbackText={person.name}
                  className="aspect-[2/3] w-full rounded-xl"
                />
                <p className="mt-2 truncate text-[13px] font-semibold">{person.name}</p>
                {person.character && (
                  <p className="truncate text-[11.5px] text-fg-dim">{person.character}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {similarFromLibrary.length > 0 && (
        <div className="mt-6">
          <ContentRow title="Kütüphanenden benzer içerikler">
            {similarFromLibrary.map((candidate) => (
              <ContentCard
                key={candidate.id}
                id={candidate.id}
                title={candidate.title}
                href={`/movie/${candidate.id}`}
                type="movie"
                year={candidate.year}
                logo={candidate.logo}
              />
            ))}
          </ContentRow>
        </div>
      )}
    </div>
  );
}

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}s ${rest}dk` : `${rest}dk`;
}
