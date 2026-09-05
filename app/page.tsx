"use client";

import { useMemo } from "react";

import { ChannelTile } from "@/components/content/ChannelTile";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentRow } from "@/components/content/ContentRow";
import { ProgressCard } from "@/components/content/ProgressCard";
import { ProviderCard } from "@/components/content/ProviderCard";
import { AddSourcePanel } from "@/components/home/AddSourcePanel";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { HeroBanner, toHeroEntry } from "@/components/home/HeroBanner";
import { QuickTiles } from "@/components/home/QuickTiles";
import { RowSkeleton } from "@/components/ui/States";
import { useCategoryGroups, useChannels, useMovies, useSeries } from "@/lib/hooks/useLibrarySelectors";
import { groupChannelsByCategory } from "@/lib/library/channelCategories";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useContinueWatching } from "@/lib/store/userStore";

export default function HomePage() {
  const hydrated = useLibraryStore((state) => state.hydrated);
  const providers = useLibraryStore((state) => state.providers);

  const movies = useMovies();
  const series = useSeries();
  const channels = useChannels();
  const continueWatching = useContinueWatching();

  const movieCategories = useCategoryGroups(movies, 4, 12);
  const channelCategories = useMemo(() => groupChannelsByCategory(channels), [channels]);

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
        <div className="px-4 sm:px-5 lg:px-8">
          <div className="skeleton h-[220px] rounded-3xl sm:h-[380px] xl:h-[440px]" />
        </div>
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  const isEmpty = movies.length === 0 && series.length === 0 && channels.length === 0;

  return (
    <div className="pb-10">
      {/* Kaynak ekleme her zaman en üstte: uygulamanın ilk işi M3U eklemek. */}
      <AddSourcePanel />

      {isEmpty && (
        <p className="px-4 pt-6 text-center text-[14px] leading-relaxed text-fg-muted sm:px-5 lg:px-8">
          Kütüphanen henüz boş. Yukarıdaki seçeneklerden biriyle listeni ekle; içerikler otomatik olarak
          film, dizi ve canlı kanallara ayrılacak.
        </p>
      )}

      {heroEntries.length > 0 && <HeroBanner entries={heroEntries} />}

      <QuickTiles />

      {continueWatching.length > 0 && (
        <ContentRow title="Devam Et" href="/history">
          {continueWatching.map((progress) => (
            <ProgressCard key={progress.contentId} progress={progress} />
          ))}
        </ContentRow>
      )}

      {providers.length > 1 && (
        <ContentRow title="Platformlar" meta={`${providers.length} platform`}>
          {providers.map((provider) => (
            <ProviderCard key={provider.slug} provider={provider} />
          ))}
        </ContentRow>
      )}

      {/* Film türleri — playlistteki grup adlarından türetiliyor */}
      {movieCategories.length > 0 && (
        <CategoryTiles
          title="Film Kategorileri"
          tiles={movieCategories.map((group) => ({
            name: group.name,
            count: group.items.length,
            href: `/movies?category=${encodeURIComponent(group.name)}`,
          }))}
        />
      )}

      {/* Canlı TV kategorileri — Spor / Ulusal / Haber / Çocuk … */}
      {channelCategories.length > 0 && (
        <CategoryTiles
          title="Canlı TV Kategorileri"
          tiles={channelCategories.map((entry) => ({
            name: entry.category.label,
            count: entry.channels.length,
            href: `/live?category=${entry.category.id}`,
          }))}
        />
      )}

      {movies.length > 0 && (
        <ContentRow
          title="Filmler"
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
          title="Diziler"
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
              subtitle={`${item.seasons.length} Sezon · ${item.episodeCount} Bölüm`}
            />
          ))}
        </ContentRow>
      )}

      {/* Her canlı kategori için ayrı raf: spor ayrı, ulusal ayrı … */}
      {channelCategories.slice(0, 6).map((entry) => (
        <ContentRow
          key={entry.category.id}
          title={entry.category.label}
          href={`/live?category=${entry.category.id}`}
          meta={`${entry.channels.length.toLocaleString("tr-TR")} kanal`}
        >
          {entry.channels.slice(0, 20).map((channel) => (
            <ChannelTile key={channel.id} channel={channel} />
          ))}
        </ContentRow>
      ))}

      {/* Film türlerinden ilk birkaçı raf olarak */}
      {movieCategories.slice(0, 4).map((group) => (
        <ContentRow
          key={group.name}
          title={group.name}
          href={`/movies?category=${encodeURIComponent(group.name)}`}
          meta={`${group.items.length} film`}
        >
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
    </div>
  );
}
