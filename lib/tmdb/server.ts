import "server-only";

import type { TmdbMeta } from "@/lib/types";

/**
 * TMDB erişimi SADECE sunucu tarafında yapılır — API key hiçbir zaman
 * client bundle'ına girmez. Client, /api/tmdb/* route'larıyla konuşur.
 */

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export function tmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY?.trim());
}

function language(): string {
  return process.env.TMDB_LANGUAGE?.trim() || "tr-TR";
}

/** Aynı istekleri tekrar tekrar TMDB'ye göndermemek için basit süreç-içi cache. */
const memoryCache = new Map<string, { expires: number; value: unknown }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 saat

function cacheGet<T>(key: string): T | undefined {
  const hit = memoryCache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  if (memoryCache.size > 2000) {
    // En eski 500 kaydı at (basit LRU yerine FIFO — yeterli).
    let removed = 0;
    for (const cacheKey of memoryCache.keys()) {
      memoryCache.delete(cacheKey);
      if (++removed >= 500) break;
    }
  }
  memoryCache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) throw new TmdbNotConfiguredError();

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("language", language());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { accept: "application/json" };
  // v4 Read Access Token (JWT) → Bearer; v3 key → query param.
  if (apiKey.startsWith("ey")) headers.Authorization = `Bearer ${apiKey}`;
  else url.searchParams.set("api_key", apiKey);

  const cacheKey = url.toString();
  const cached = cacheGet<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(url, { headers, next: { revalidate: 60 * 60 * 6 } });

  if (response.status === 429) throw new TmdbError("TMDB istek limiti aşıldı, biraz sonra tekrar deneyin", 429);
  if (response.status === 401) throw new TmdbError("TMDB API anahtarı geçersiz", 401);
  if (!response.ok) throw new TmdbError(`TMDB isteği başarısız (${response.status})`, response.status);

  const json = (await response.json()) as T;
  cacheSet(cacheKey, json);
  return json;
}

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

export class TmdbNotConfiguredError extends TmdbError {
  constructor() {
    super("TMDB API anahtarı tanımlı değil", 503);
    this.name = "TmdbNotConfiguredError";
  }
}

interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity?: number;
}

export interface TmdbSearchMatch {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  rating?: number;
  overview?: string;
}

/**
 * Başlık eşleştirme. M3U başlıkları gürültülü olduğu için:
 *  1. Tam metin araması yapılır
 *  2. Sonuçlar başlık benzerliği + yıl yakınlığı + popülerliğe göre skorlanır
 *  3. Skor eşiğin altındaysa eşleşme yok kabul edilir (yanlış poster göstermemek için)
 */
export async function searchTitle(
  query: string,
  options: { year?: number; type?: "movie" | "tv" } = {},
): Promise<TmdbSearchMatch | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const mediaType = options.type ?? "movie";
  const path = mediaType === "tv" ? "/search/tv" : "/search/movie";
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>(path, {
    query: trimmed,
    include_adult: "false",
    ...(options.year ? (mediaType === "tv" ? { first_air_date_year: options.year } : { year: options.year }) : {}),
  });

  const results = data.results ?? [];
  if (results.length === 0) return null;

  const scored = results
    .map((result) => ({ result, score: scoreMatch(trimmed, options.year, result) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.45) return null;

  return toMatch(best.result, mediaType);
}

function toMatch(result: TmdbSearchResult, mediaType: "movie" | "tv"): TmdbSearchMatch {
  const date = result.release_date || result.first_air_date;
  return {
    tmdbId: result.id,
    mediaType,
    title: result.title || result.name || "",
    poster: imageUrl(result.poster_path, "w500"),
    backdrop: imageUrl(result.backdrop_path, "w1280"),
    year: date ? Number(date.slice(0, 4)) : undefined,
    rating: result.vote_average ? Number(result.vote_average.toFixed(1)) : undefined,
    overview: result.overview || undefined,
  };
}

function scoreMatch(query: string, year: number | undefined, result: TmdbSearchResult): number {
  const candidates = [result.title, result.name, result.original_title, result.original_name].filter(
    Boolean,
  ) as string[];
  const titleScore = Math.max(...candidates.map((candidate) => similarity(query, candidate)), 0);

  const date = result.release_date || result.first_air_date;
  const resultYear = date ? Number(date.slice(0, 4)) : undefined;
  let yearScore = 0;
  if (year && resultYear) {
    const diff = Math.abs(year - resultYear);
    yearScore = diff === 0 ? 0.2 : diff === 1 ? 0.1 : -0.15;
  }

  const popularityScore = Math.min((result.popularity ?? 0) / 500, 0.1);
  return titleScore * 0.8 + yearScore + popularityScore;
}

/** Dice katsayısı (bigram) — kısa başlıklarda Levenshtein'dan daha stabil. */
function similarity(a: string, b: string): number {
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase("en-US")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const bigrams = (value: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < value.length - 1; i++) {
      const gram = value.slice(i, i + 2);
      set.set(gram, (set.get(gram) ?? 0) + 1);
    }
    return set;
  };

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  let intersection = 0;
  for (const [gram, count] of leftGrams) {
    const other = rightGrams.get(gram);
    if (other) intersection += Math.min(count, other);
  }
  const total = left.length - 1 + (right.length - 1);
  return total > 0 ? (2 * intersection) / total : 0;
}

interface TmdbDetails extends TmdbSearchResult {
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  credits?: {
    cast?: { name: string; character?: string; profile_path?: string | null }[];
    crew?: { name: string; job?: string }[];
  };
  similar?: { results: TmdbSearchResult[] };
  recommendations?: { results: TmdbSearchResult[] };
}

export async function getDetails(tmdbId: number, mediaType: "movie" | "tv"): Promise<TmdbMeta> {
  const data = await tmdbFetch<TmdbDetails>(`/${mediaType}/${tmdbId}`, {
    append_to_response: "credits,recommendations",
  });

  const date = data.release_date || data.first_air_date;
  const similarSource = data.recommendations?.results ?? data.similar?.results ?? [];

  return {
    tmdbId: data.id,
    mediaType,
    title: data.title || data.name || "",
    originalTitle: data.original_title || data.original_name || undefined,
    overview: data.overview || undefined,
    poster: imageUrl(data.poster_path, "w500"),
    backdrop: imageUrl(data.backdrop_path, "original"),
    year: date ? Number(date.slice(0, 4)) : undefined,
    rating: data.vote_average ? Number(data.vote_average.toFixed(1)) : undefined,
    genres: (data.genres ?? []).map((genre) => genre.name),
    runtime: data.runtime ?? data.episode_run_time?.[0],
    cast: (data.credits?.cast ?? []).slice(0, 12).map((person) => ({
      name: person.name,
      character: person.character || undefined,
      photo: imageUrl(person.profile_path, "w185"),
    })),
    director: data.credits?.crew?.find((person) => person.job === "Director")?.name,
    similar: similarSource.slice(0, 12).map((item) => ({
      tmdbId: item.id,
      title: item.title || item.name || "",
      poster: imageUrl(item.poster_path, "w342"),
      year: (item.release_date || item.first_air_date)?.slice(0, 4)
        ? Number((item.release_date || item.first_air_date)!.slice(0, 4))
        : undefined,
    })),
  };
}

function imageUrl(path: string | null | undefined, size: string): string | undefined {
  return path ? `${IMAGE_BASE}/${size}${path}` : undefined;
}
