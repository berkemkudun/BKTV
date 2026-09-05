"use client";

import { useMemo } from "react";

import { isTurkishItem, isTurkishSeries, turkishFirst } from "@/lib/library/turkish";
import { useLibraryStore } from "@/lib/store/libraryStore";
import type { ContentItem, ContentType, SeriesItem } from "@/lib/types";

/*
 * Listeler Türkçe içerik önce gelecek şekilde sıralanır: gerçek listelerde
 * onlarca ülkenin kanalı bir arada geliyor ve kullanıcı pratikte Türkçe
 * olanları arıyor. Sıralama kararlı — aynı dildekiler listedeki sırasını korur.
 */

/** Filmler (dizi bölümleri hariç). */
export function useMovies(providerSlug?: string): ContentItem[] {
  const items = useLibraryStore((state) => state.items);
  return useMemo(
    () =>
      turkishFirst(
        items.filter(
          (item) => item.type === "movie" && (!providerSlug || item.providerSlug === providerSlug),
        ),
        isTurkishItem,
      ),
    [items, providerSlug],
  );
}

export function useSeries(providerSlug?: string): SeriesItem[] {
  const series = useLibraryStore((state) => state.series);
  return useMemo(
    () =>
      turkishFirst(
        series.filter((item) => !providerSlug || item.providerSlug === providerSlug),
        isTurkishSeries,
      ),
    [series, providerSlug],
  );
}

/** Canlı yayınlar: live + sports + news + kids. */
export function useChannels(providerSlug?: string): ContentItem[] {
  const items = useLibraryStore((state) => state.items);
  return useMemo(
    () =>
      turkishFirst(
        items.filter(
          (item) =>
            (item.type === "live" ||
              item.type === "sports" ||
              item.type === "news" ||
              item.type === "kids") &&
            (!providerSlug || item.providerSlug === providerSlug),
        ),
        isTurkishItem,
      ),
    [items, providerSlug],
  );
}

/** Tek bir içeriği id ile bul (film, kanal veya dizi bölümü). */
export function useContentItem(id: string | undefined): ContentItem | undefined {
  const items = useLibraryStore((state) => state.items);
  return useMemo(() => (id ? items.find((item) => item.id === id) : undefined), [items, id]);
}

export function useSeriesItem(id: string | undefined): SeriesItem | undefined {
  const series = useLibraryStore((state) => state.series);
  return useMemo(() => (id ? series.find((item) => item.id === id) : undefined), [series, id]);
}

/** Kategoriye göre gruplanmış içerikler — boş kategoriler döndürülmez. */
export function useCategoryGroups(items: ContentItem[], minCount = 4, maxGroups = 8) {
  return useMemo(() => {
    const groups = new Map<string, ContentItem[]>();
    for (const item of items) {
      const key = item.category?.trim();
      if (!key) continue;
      const bucket = groups.get(key) ?? [];
      bucket.push(item);
      groups.set(key, bucket);
    }
    return [...groups.entries()]
      .filter(([, bucket]) => bucket.length >= minCount)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, maxGroups)
      .map(([name, bucket]) => ({ name, items: bucket }));
  }, [items, minCount, maxGroups]);
}

/** Basit arama: başlık üzerinde normalize edilmiş "içerir" araması. */
export function searchLibrary(
  query: string,
  items: ContentItem[],
  series: SeriesItem[],
  limitPerType = 40,
) {
  const normalized = normalize(query);
  if (!normalized) return { movies: [], series: [], channels: [] };

  const movies: ContentItem[] = [];
  const channels: ContentItem[] = [];
  const matchedSeries: SeriesItem[] = [];

  /*
   * Önce geniş bir havuz toplanır (limitin 5 katı), sonra Türkçe olanlar başa
   * alınıp kesilir. Doğrudan limitte kesmek, Türkçe sonuçlar listenin sonunda
   * kaldığında onları tamamen eliyordu.
   */
  const pool = limitPerType * 5;

  for (const item of items) {
    if (item.type === "series") continue;
    if (movies.length >= pool && channels.length >= pool) break;
    if (!normalize(item.title).includes(normalized)) continue;
    if (item.type === "movie") {
      if (movies.length < pool) movies.push(item);
    } else if (channels.length < pool) {
      channels.push(item);
    }
  }

  for (const item of series) {
    if (matchedSeries.length >= pool) break;
    if (normalize(item.title).includes(normalized)) matchedSeries.push(item);
  }

  return {
    movies: turkishFirst(movies, isTurkishItem).slice(0, limitPerType),
    series: turkishFirst(matchedSeries, isTurkishSeries).slice(0, limitPerType),
    channels: turkishFirst(channels, isTurkishItem).slice(0, limitPerType),
  };
}

export function typeLabel(type: ContentType): string {
  switch (type) {
    case "movie":
      return "Film";
    case "series":
      return "Dizi";
    case "live":
      return "Canlı TV";
    case "sports":
      return "Spor";
    case "news":
      return "Haber";
    case "kids":
      return "Çocuk";
    default:
      return "Diğer";
  }
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
