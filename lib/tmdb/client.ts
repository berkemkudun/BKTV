"use client";

import { STORES, idbGet, idbPut } from "@/lib/storage/idb";
import type { TmdbMeta } from "@/lib/types";

export interface TmdbMatch {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  rating?: number;
  overview?: string;
}

interface CacheRecord {
  id: string;
  match: TmdbMatch | null;
  savedAt: number;
}

const MEMORY_CACHE = new Map<string, TmdbMatch | null>();
const INFLIGHT = new Map<string, Promise<TmdbMatch | null>>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 gün

/**
 * TMDB istek kuyruğu.
 *
 * 10.000 içerikli bir kütüphanenin tamamını TMDB'de aramak ne mümkün ne de gerekli.
 * Bunun yerine sadece EKRANDA GÖRÜNEN kartlar (IntersectionObserver ile) sıraya girer,
 * eşzamanlı istek sayısı sınırlanır ve sonuçlar IndexedDB'de kalıcı olarak saklanır.
 */
const MAX_CONCURRENT = 4;
let active = 0;
const queue: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    queue.push(() => {
      active++;
      resolve();
    });
  });
}

function release() {
  active--;
  const next = queue.shift();
  if (next) next();
}

function cacheKey(title: string, year: number | undefined, type: "movie" | "tv"): string {
  return `${type}:${title.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-")}:${year ?? ""}`;
}

/** Tek bir başlık için TMDB eşleşmesi. Bulunamazsa null (bu da cache'lenir). */
export async function matchTitle(
  title: string,
  options: { year?: number; type?: "movie" | "tv" } = {},
): Promise<TmdbMatch | null> {
  const type = options.type ?? "movie";
  const key = cacheKey(title, options.year, type);

  if (MEMORY_CACHE.has(key)) return MEMORY_CACHE.get(key) ?? null;
  const inflight = INFLIGHT.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    // Sunucuda TMDB anahtarı yoksa hiç istek atma — kütüphane 10.000 karttan
    // oluşabiliyor, hepsi için boşa giden bir istek anlamsız olurdu.
    if (!(await tmdbStatus())) {
      MEMORY_CACHE.set(key, null);
      INFLIGHT.delete(key);
      return null;
    }

    try {
      const cached = await idbGet<CacheRecord>(STORES.tmdb, key).catch(() => undefined);
      if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
        MEMORY_CACHE.set(key, cached.match);
        return cached.match;
      }
    } catch {
      /* cache okunamadı, ağdan devam */
    }

    await acquire();
    try {
      const params = new URLSearchParams({ title, type });
      if (options.year) params.set("year", String(options.year));
      const response = await fetch(`/api/tmdb/search?${params.toString()}`);
      if (!response.ok) {
        MEMORY_CACHE.set(key, null);
        return null;
      }
      const data = (await response.json()) as { match: TmdbMatch | null };
      const match = data.match ?? null;
      MEMORY_CACHE.set(key, match);
      void idbPut<CacheRecord>(STORES.tmdb, { id: key, match, savedAt: Date.now() }).catch(() => {});
      return match;
    } catch {
      MEMORY_CACHE.set(key, null);
      return null;
    } finally {
      release();
      INFLIGHT.delete(key);
    }
  })();

  INFLIGHT.set(key, promise);
  return promise;
}

export async function fetchTmdbDetails(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<TmdbMeta | null> {
  try {
    const response = await fetch(`/api/tmdb/details?id=${tmdbId}&type=${mediaType}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { meta: TmdbMeta | null };
    return data.meta ?? null;
  } catch {
    return null;
  }
}

let statusPromise: Promise<boolean> | null = null;

/** TMDB anahtarı tanımlı mı? (sunucudan tek sefer sorulur) */
export function tmdbStatus(): Promise<boolean> {
  if (!statusPromise) {
    statusPromise = fetch("/api/tmdb/status")
      .then((response) => (response.ok ? response.json() : { configured: false }))
      .then((data: { configured?: boolean }) => Boolean(data.configured))
      .catch(() => false);
  }
  return statusPromise;
}
