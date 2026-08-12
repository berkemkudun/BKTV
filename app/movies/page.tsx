"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { ContentCard } from "@/components/content/ContentCard";
import { FilterBar } from "@/components/content/FilterBar";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { useMovies } from "@/lib/hooks/useLibrarySelectors";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";

export default function MoviesPage() {
  return (
    <Suspense fallback={<div className="px-5 pt-6 lg:px-8" />}>
      <MoviesBrowser />
    </Suspense>
  );
}

function MoviesBrowser() {
  const hydrated = useLibraryStore((state) => state.hydrated);
  const providers = useLibraryStore((state) => state.providers);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);
  const movies = useMovies();

  // Ana sayfadaki kategori kutucukları /movies?category=Aksiyon adresine gider.
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";

  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState(categoryParam);

  const [trackedParam, setTrackedParam] = useState(categoryParam);
  if (trackedParam !== categoryParam) {
    setTrackedParam(categoryParam);
    setCategory(categoryParam);
  }

  const providerOptions = useMemo(
    () =>
      providers
        .filter((item) => item.movieCount > 0)
        .map((item) => ({ value: item.slug, label: item.name, count: item.movieCount })),
    [providers],
  );

  const filteredByProvider = useMemo(
    () => (provider ? movies.filter((item) => item.providerSlug === provider) : movies),
    [movies, provider],
  );

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of filteredByProvider) {
      const key = item.category?.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([label, count]) => ({ value: label, label, count }));
  }, [filteredByProvider]);

  const filtered = useMemo(
    () => (category ? filteredByProvider.filter((item) => item.category === category) : filteredByProvider),
    [filteredByProvider, category],
  );

  const { visible, sentinelRef, hasMore, total } = usePagedList(filtered, 60);

  if (!hydrated) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5 px-5 pt-6 lg:px-8">
        {Array.from({ length: 18 }).map((_, index) => (
          <LoadingSkeleton key={index} className="aspect-[2/3]" />
        ))}
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <EmptyState
        title="Film bulunamadı"
        message="Yüklü playlistlerde film olarak sınıflandırılan içerik yok. Farklı bir M3U listesi ekleyebilirsin."
        actionLabel="Playlist Ekle"
        onAction={openPlaylistDialog}
      />
    );
  }

  return (
    <div className="pt-4">
      <FilterBar options={providerOptions} value={provider} onChange={setProvider} allLabel="Tüm Platformlar" />
      {categoryOptions.length > 0 && (
        <div className="mt-1">
          <FilterBar options={categoryOptions} value={category} onChange={setCategory} allLabel="Tüm Türler" />
        </div>
      )}

      <p className="px-5 pt-4 text-[13px] text-fg-dim lg:px-8">
        {total.toLocaleString("tr-TR")} film
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7 px-5 pt-4 lg:px-8">
        {visible.map((item) => (
          <ContentCard
            key={item.id}
            id={item.id}
            title={item.title}
            href={`/movie/${item.id}`}
            type="movie"
            year={item.year}
            logo={item.logo}
            fill
          />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5 px-5 pt-7 lg:px-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} className="aspect-[2/3]" />
          ))}
        </div>
      )}
    </div>
  );
}
