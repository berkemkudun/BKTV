"use client";

import { useMemo, useState } from "react";

import { ContentCard } from "@/components/content/ContentCard";
import { FilterBar } from "@/components/content/FilterBar";
import { EmptyState } from "@/components/ui/States";
import { typeLabel } from "@/lib/hooks/useLibrarySelectors";
import { useFavoriteList } from "@/lib/store/userStore";
import type { ContentType } from "@/lib/types";

export default function FavoritesPage() {
  const favorites = useFavoriteList();
  const [type, setType] = useState("");

  const typeOptions = useMemo(() => {
    const counts = new Map<ContentType, number>();
    for (const entry of favorites) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
    return [...counts.entries()].map(([value, count]) => ({
      value,
      label: typeLabel(value),
      count,
    }));
  }, [favorites]);

  const filtered = useMemo(
    () => (type ? favorites.filter((entry) => entry.type === type) : favorites),
    [favorites, type],
  );

  if (favorites.length === 0) {
    return (
      <EmptyState
        title="Henüz favorin yok"
        message="Kartların üzerindeki kalp simgesine tıklayarak film, dizi ve kanalları buraya ekleyebilirsin."
        actionLabel="İçerikleri keşfet"
        actionHref="/"
      />
    );
  }

  return (
    <div className="pt-4">
      {typeOptions.length > 1 && (
        <FilterBar options={typeOptions} value={type} onChange={setType} allLabel="Tümü" />
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7 px-4 sm:px-5 pt-6 lg:px-8">
        {filtered.map((entry) => (
          <ContentCard
            key={entry.id}
            id={entry.id}
            title={entry.title}
            href={hrefForFavorite(entry.id, entry.type)}
            type={entry.type}
            logo={entry.poster ?? entry.logo}
            tmdbType={entry.type === "series" ? "tv" : "movie"}
            disableTmdb={entry.type !== "movie" && entry.type !== "series"}
            subtitle={typeLabel(entry.type)}
            fill
          />
        ))}
      </div>
    </div>
  );
}

function hrefForFavorite(id: string, type: ContentType): string {
  if (type === "movie") return `/movie/${id}`;
  if (type === "series") return `/series/${id}`;
  return `/watch/${id}`;
}
