"use client";

import { useMemo } from "react";
import { create } from "zustand";

import { DEFAULT_PREFERENCES, preferencesRepository } from "@/lib/storage/repository";
import type { ContentType, FavoriteEntry, PlayerSettings, UserPreferences, WatchProgress } from "@/lib/types";

interface UserState extends UserPreferences {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleFavorite: (entry: Omit<FavoriteEntry, "addedAt">) => void;
  isFavorite: (id: string) => boolean;
  saveProgress: (progress: Omit<WatchProgress, "percent" | "updatedAt">) => void;
  removeProgress: (contentId: string) => void;
  clearHistory: () => void;
  updatePlayerSettings: (patch: Partial<PlayerSettings>) => void;
  setTmdbEnabled: (enabled: boolean) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  ...DEFAULT_PREFERENCES,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const preferences = await preferencesRepository.load();
    set({ ...preferences, hydrated: true });
  },

  toggleFavorite: (entry) => {
    const favorites = { ...get().favorites };
    if (favorites[entry.id]) delete favorites[entry.id];
    else favorites[entry.id] = { ...entry, addedAt: Date.now() };
    set({ favorites });
    persist();
  },

  isFavorite: (id) => Boolean(get().favorites[id]),

  saveProgress: (progress) => {
    if (!get().player.rememberPosition) return;
    if (!Number.isFinite(progress.durationSec) || progress.durationSec <= 0) return;

    const percent = Math.min(100, Math.round((progress.positionSec / progress.durationSec) * 100));
    const watchHistory = { ...get().watchHistory };

    // Neredeyse bitmiş içeriği "devam et" listesinde tutma.
    if (percent >= 95) delete watchHistory[progress.contentId];
    else watchHistory[progress.contentId] = { ...progress, percent, updatedAt: Date.now() };

    set({ watchHistory });
    persist();
  },

  removeProgress: (contentId) => {
    const watchHistory = { ...get().watchHistory };
    delete watchHistory[contentId];
    set({ watchHistory });
    persist();
  },

  clearHistory: () => {
    set({ watchHistory: {} });
    persist();
  },

  updatePlayerSettings: (patch) => {
    set({ player: { ...get().player, ...patch } });
    persist();
  },

  setTmdbEnabled: (enabled) => {
    set({ tmdbEnabled: enabled });
    persist();
  },
}));

/** Yazma işlemlerini toplayıp tek seferde diske indirir (oynatma sırasında saniyede 1 çağrı gelebilir). */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const state = useUserStore.getState();
    const preferences: UserPreferences = {
      favorites: state.favorites,
      watchHistory: state.watchHistory,
      selectedProviders: state.selectedProviders,
      player: state.player,
      tmdbEnabled: state.tmdbEnabled,
    };
    void preferencesRepository.save(preferences);
  }, 400);
}

/**
 * "Devam Et" rafı için en son izlenenler.
 *
 * Not: Türetilmiş diziyi doğrudan store selector'ında üretmiyoruz — her çağrıda
 * yeni referans dönerdi ve useSyncExternalStore sonsuz render döngüsüne girerdi.
 * Bunun yerine ham kaydı seçip useMemo ile türetiyoruz.
 */
export function useContinueWatching(limit = 12): WatchProgress[] {
  const watchHistory = useUserStore((state) => state.watchHistory);
  return useMemo(
    () =>
      Object.values(watchHistory)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit),
    [watchHistory, limit],
  );
}

export function useFavoriteList(type?: ContentType): FavoriteEntry[] {
  const favorites = useUserStore((state) => state.favorites);
  return useMemo(
    () =>
      Object.values(favorites)
        .filter((entry) => (type ? entry.type === type : true))
        .sort((a, b) => b.addedAt - a.addedAt),
    [favorites, type],
  );
}
