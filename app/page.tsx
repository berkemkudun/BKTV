"use client";

import { useMemo } from "react";

import { ContentCard } from "@/components/content/ContentCard";
import { ContentRow } from "@/components/content/ContentRow";
import { ProgressCard } from "@/components/content/ProgressCard";
import { ProviderCard } from "@/components/content/ProviderCard";
import { HeroBanner, toHeroEntry } from "@/components/home/HeroBanner";
import { QuickTiles } from "@/components/home/QuickTiles";
import { EmptyState, RowSkeleton } from "@/components/ui/States";
import { useCategoryGroups, useChannels, useMovies, useSeries } from "@/lib/hooks/useLibrarySelectors";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useContinueWatching } from "@/lib/store/userStore";

export default function HomePage() {
  const hydrated = useLibraryStore((state) => state.hydrated);
  const providers = useLibraryStore((state) => state.providers);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);

  const movies = useMovies();
  const series = useSeries();
  const channels = useChannels();
  const continueWatching = useContinueWatching();
  const categoryGroups = useCategoryGroups(movies, 6, 4);

  const heroEntries = useMemo(() => {
    const topMovies = [...movies]
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      .slice(0, 3)
      .map((item) => toHeroEntry(item, "movie"));
    const topSeries = [...series]
      .sort((a, b) => b.episodeCount - a.episodeCount)
      .slice(0, 2)
      .map((item) => toHeroEntry(item, "series"));
    return [...topSeries.slice(0, 1), ...topMovies, ...topSeries.slice(1)].slice(0, 5);
  }, [movies, series]);

  if (!hydrated) {
    return (
      <div className="space-y-8 pt-6">
        <div className="px-5 lg:px-8">
          <div className="skeleton h-[380px] rounded-3xl xl:h-[440px]" />
        </div>
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (movies.length === 0 && series.length === 0 && channels.length === 0) {
    return (
      <EmptyState
        title="Kütüphanen boş"
        message="Başlamak için bir M3U playlist ekle. Listeyi indirip platformlara ayıracağız."
        actionLabel="Playlist Ekle"
        onAction={openPlaylistDialog}
      />
    );
  }

  return (
    <div className="pb-10">
      {heroEntries.length > 0 && <HeroBanner entries={heroEntries} />}

      <QuickTiles />

      {providers.length > 0 && (
        <ContentRow title="Platformlar" meta={`${providers.length} platform`}>
          {providers.map((provider) => (
            <ProviderCard key={provider.slug} provider={provider} />
          ))}
        </ContentRow>
      )}

      {continueWatching.length > 0 && (
        <ContentRow title="Devam Et" href="/history">
          {continueWatching.map((progress) => (
            <ProgressCard key={progress.contentId} progress={progress} />
          ))}
        </ContentRow>
      )}

      {movies.length > 0 && (
        <ContentRow
          title="Popüler Filmler"
          href="/movies"
          meta={`${movies.length.toLocaleString("tr-TR")} film`}
        >
          {movies.slice(0, 20).map((item) => (
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

      {series.length > 0 && (
        <ContentRow
          title="Popüler Diziler"
          href="/series"
          meta={`${series.length.toLocaleString("tr-TR")} dizi`}
        >
          {series.slice(0, 20).map((item) => (
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

      {categoryGroups.map((group) => (
        <ContentRow key={group.name} title={group.name} meta={`${group.items.length} içerik`}>
          {group.items.slice(0, 20).map((item) => (
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
        <ContentRow
          title="Canlı Kanallar"
          href="/live"
          meta={`${channels.length.toLocaleString("tr-TR")} kanal`}
        >
          {channels.slice(0, 20).map((item) => (
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
