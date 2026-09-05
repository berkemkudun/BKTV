"use client";

import { useMemo, useState } from "react";

import { ContentCard } from "@/components/content/ContentCard";
import { FilterBar } from "@/components/content/FilterBar";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { useSeries } from "@/lib/hooks/useLibrarySelectors";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";

export default function SeriesPage() {
  const hydrated = useLibraryStore((state) => state.hydrated);
  const providers = useLibraryStore((state) => state.providers);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);
  const series = useSeries();

  const [provider, setProvider] = useState("");

  const providerOptions = useMemo(
    () =>
      providers
        .filter((item) => item.seriesCount > 0)
        .map((item) => ({ value: item.slug, label: item.name, count: item.seriesCount })),
    [providers],
  );

  const filtered = useMemo(
    () => (provider ? series.filter((item) => item.providerSlug === provider) : series),
    [series, provider],
  );

  const { visible, sentinelRef, hasMore, total } = usePagedList(filtered, 60);

  if (!hydrated) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-5 px-4 sm:px-5 pt-6 lg:px-8">
        {Array.from({ length: 18 }).map((_, index) => (
          <LoadingSkeleton key={index} className="aspect-[2/3]" />
        ))}
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <EmptyState
        title="Dizi bulunamadı"
        message="Playlistlerinde S01E01 gibi bölüm bilgisi taşıyan içerik bulunamadı. Diziler bu kalıplarla otomatik gruplanıyor."
        actionLabel="Playlist Ekle"
        onAction={openPlaylistDialog}
      />
    );
  }

  return (
    <div className="pt-4">
      <FilterBar options={providerOptions} value={provider} onChange={setProvider} allLabel="Tüm Platformlar" />

      <p className="px-4 sm:px-5 pt-4 text-[13px] text-fg-dim lg:px-8">{total.toLocaleString("tr-TR")} dizi</p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7 px-4 sm:px-5 pt-4 lg:px-8">
        {visible.map((item) => (
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
            fill
          />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-5 px-4 sm:px-5 pt-7 lg:px-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="aspect-[2/3]" />
          ))}
        </div>
      )}
    </div>
  );
}
