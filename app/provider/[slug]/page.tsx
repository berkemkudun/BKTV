"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";

import { ContentCard } from "@/components/content/ContentCard";
import { ContentRow } from "@/components/content/ContentRow";
import { HeroBanner, toHeroEntry } from "@/components/home/HeroBanner";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { getProvider } from "@/lib/config/providers";
import { useCategoryGroups, useChannels, useMovies, useSeries } from "@/lib/hooks/useLibrarySelectors";
import { useLibraryStore } from "@/lib/store/libraryStore";

export default function ProviderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const hydrated = useLibraryStore((state) => state.hydrated);
  const providers = useLibraryStore((state) => state.providers);

  const movies = useMovies(slug);
  const series = useSeries(slug);
  const channels = useChannels(slug);
  const categoryGroups = useCategoryGroups(movies, 4, 8);

  const provider = providers.find((item) => item.slug === slug) ?? getProvider(slug);

  const heroEntries = useMemo(() => {
    const topSeries = [...series].sort((a, b) => b.episodeCount - a.episodeCount).slice(0, 2);
    const topMovies = [...movies].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 3);
    return [
      ...topSeries.slice(0, 1).map((item) => toHeroEntry(item, "series")),
      ...topMovies.map((item) => toHeroEntry(item, "movie")),
      ...topSeries.slice(1).map((item) => toHeroEntry(item, "series")),
    ].slice(0, 5);
  }, [movies, series]);

  if (!hydrated) {
    return (
      <div className="px-4 sm:px-5 pt-6 lg:px-8">
        <LoadingSkeleton className="h-[400px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!provider || (movies.length === 0 && series.length === 0 && channels.length === 0)) {
    return (
      <EmptyState
        title="Platform bulunamadı"
        message="Bu platforma ait içerik kütüphanende yok. Platform eşleştirmesi lib/config/providers.ts dosyasından genişletilebilir."
        actionLabel="Ana sayfaya dön"
        actionHref="/"
      />
    );
  }

  return (
    <div className="pb-10">
      <div className="px-4 sm:px-5 pt-6 lg:px-8">
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 px-6 py-5"
          style={{ background: `linear-gradient(120deg, ${provider.color}30, rgba(10,10,17,0.85))` }}
        >
          <h1
            className="text-[24px] font-extrabold tracking-tight sm:text-[30px] lg:text-[36px]"
            style={{ color: provider.color === "#111827" ? "#E8E8F0" : provider.color }}
          >
            {provider.name}
          </h1>
          <p className="text-[13.5px] font-medium text-fg-muted">
            {movies.length > 0 && `${movies.length.toLocaleString("tr-TR")} film`}
            {movies.length > 0 && (series.length > 0 || channels.length > 0) && " · "}
            {series.length > 0 && `${series.length.toLocaleString("tr-TR")} dizi`}
            {series.length > 0 && channels.length > 0 && " · "}
            {channels.length > 0 && `${channels.length.toLocaleString("tr-TR")} kanal`}
          </p>
        </div>
      </div>

      {heroEntries.length > 0 && <HeroBanner entries={heroEntries} />}

      {series.length > 0 && (
        <ContentRow title="Diziler" meta={`${series.length.toLocaleString("tr-TR")} dizi`}>
          {series.slice(0, 24).map((item) => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              href={`/series/${item.id}`}
              type="series"
              year={item.year}
              logo={item.logo}
              tmdbType="tv"
              subtitle={`${item.seasons.length} Sezon`}
            />
          ))}
        </ContentRow>
      )}

      {movies.length > 0 && (
        <ContentRow title="Filmler" href="/movies" meta={`${movies.length.toLocaleString("tr-TR")} film`}>
          {movies.slice(0, 24).map((item) => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              href={`/movie/${item.id}`}
              type="movie"
              year={item.year}
              logo={item.logo}
            />
          ))}
        </ContentRow>
      )}

      {categoryGroups.map((group) => (
        <ContentRow key={group.name} title={group.name} meta={`${group.items.length} içerik`}>
          {group.items.slice(0, 24).map((item) => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              href={`/movie/${item.id}`}
              type="movie"
              year={item.year}
              logo={item.logo}
            />
          ))}
        </ContentRow>
      ))}

      {channels.length > 0 && (
        <ContentRow title="Kanallar" href="/live" meta={`${channels.length.toLocaleString("tr-TR")} kanal`}>
          {channels.slice(0, 24).map((item) => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              href={`/watch/${item.id}`}
              type={item.type}
              logo={item.logo}
              disableTmdb
              subtitle={item.group.split("|").pop()?.trim()}
            />
          ))}
        </ContentRow>
      )}
    </div>
  );
}
