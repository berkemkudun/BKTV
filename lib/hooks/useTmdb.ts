"use client";

import { useEffect, useState } from "react";

import { useUserStore } from "@/lib/store/userStore";
import { type TmdbMatch, fetchTmdbDetails, matchTitle, tmdbStatus } from "@/lib/tmdb/client";
import type { TmdbMeta } from "@/lib/types";

/**
 * Bir başlık için TMDB eşleşmesi (poster/backdrop/puan).
 * `active` false ise hiç istek atılmaz — kart görünür alana girene kadar bekler.
 *
 * Not: `loading` bilinçli olarak state değil, türetilmiş bir değer. Böylece effect
 * içinde senkron setState yapılmıyor (cascading render).
 */
export function useTmdbMatch(
  title: string | undefined,
  options: { year?: number; type?: "movie" | "tv"; active?: boolean } = {},
) {
  const enabled = useUserStore((state) => state.tmdbEnabled);
  const { year, type = "movie", active = true } = options;
  const key = `${type}|${title ?? ""}|${year ?? ""}`;

  const [result, setResult] = useState<{ key: string; match: TmdbMatch | null } | null>(null);

  useEffect(() => {
    if (!enabled || !active || !title) return;
    let cancelled = false;
    matchTitle(title, { year, type }).then((match) => {
      if (!cancelled) setResult({ key, match });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, active, title, year, type, key]);

  const ready = result?.key === key;
  return {
    match: ready ? result.match : null,
    loading: Boolean(enabled && active && title) && !ready,
  };
}

type DetailsState = "idle" | "loading" | "ready" | "unmatched" | "disabled";

/** Detay sayfası için tam metadata (oyuncular, türler, benzer içerikler). */
export function useTmdbDetails(
  title: string | undefined,
  options: { year?: number; type?: "movie" | "tv" } = {},
) {
  const enabled = useUserStore((state) => state.tmdbEnabled);
  const { year, type = "movie" } = options;
  const key = `${type}|${title ?? ""}|${year ?? ""}`;

  const [result, setResult] = useState<{ key: string; meta: TmdbMeta | null } | null>(null);

  useEffect(() => {
    if (!title || !enabled) return;
    let cancelled = false;

    (async () => {
      const match = await matchTitle(title, { year, type });
      if (cancelled) return;
      const meta = match ? await fetchTmdbDetails(match.tmdbId, match.mediaType) : null;
      if (!cancelled) setResult({ key, meta });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, title, year, type, key]);

  const ready = result?.key === key;
  let state: DetailsState = "idle";
  if (!title) state = "idle";
  else if (!enabled) state = "disabled";
  else if (!ready) state = "loading";
  else state = result?.meta ? "ready" : "unmatched";

  return { meta: ready ? result.meta : null, state };
}

/** TMDB anahtarı sunucuda tanımlı mı? Ayarlar ve uyarı rozetleri için. */
export function useTmdbConfigured() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmdbStatus().then((value) => {
      if (!cancelled) setConfigured(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return configured;
}
