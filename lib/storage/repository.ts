import type { ContentItem, Playlist, SeriesItem, UserPreferences } from "@/lib/types";
import {
  STORES,
  idbClear,
  idbDelete,
  idbDeleteByIndex,
  idbGetAll,
  idbPut,
  idbReplaceByIndex,
} from "@/lib/storage/idb";

/**
 * Storage abstraction.
 *
 * Uygulamanın hiçbir yeri IndexedDB/localStorage'ı doğrudan çağırmaz; sadece bu
 * arayüzü kullanır. Supabase'e geçerken yapılacak tek şey `SupabaseLibraryRepository`
 * yazıp aşağıdaki `libraryRepository` export'unu değiştirmektir — tablolar
 * lib/types.ts'teki modellerle birebir aynıdır (playlists, items, series, preferences).
 */
export interface LibraryRepository {
  listPlaylists(): Promise<Playlist[]>;
  savePlaylist(playlist: Playlist): Promise<void>;
  deletePlaylist(playlistId: string): Promise<void>;
  listItems(): Promise<ContentItem[]>;
  listSeries(): Promise<SeriesItem[]>;
  replacePlaylistContent(playlistId: string, items: ContentItem[], series: SeriesItem[]): Promise<void>;
  clearAll(): Promise<void>;
}

export interface PreferencesRepository {
  load(): Promise<UserPreferences>;
  save(preferences: UserPreferences): Promise<void>;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  favorites: {},
  watchHistory: {},
  selectedProviders: [],
  player: {
    autoplay: true,
    rememberPosition: true,
    defaultQuality: "auto",
    useStreamProxy: false,
  },
  tmdbEnabled: true,
};

class IndexedDbLibraryRepository implements LibraryRepository {
  listPlaylists() {
    return idbGetAll<Playlist>(STORES.playlists);
  }

  savePlaylist(playlist: Playlist) {
    return idbPut(STORES.playlists, playlist);
  }

  async deletePlaylist(playlistId: string) {
    await idbDelete(STORES.playlists, playlistId);
    await idbDeleteByIndex(STORES.items, "playlistId", playlistId);
    await idbDeleteByIndex(STORES.series, "playlistId", playlistId);
  }

  listItems() {
    return idbGetAll<ContentItem>(STORES.items);
  }

  listSeries() {
    return idbGetAll<SeriesItem>(STORES.series);
  }

  async replacePlaylistContent(playlistId: string, items: ContentItem[], series: SeriesItem[]) {
    // Her store için tek transaction: sil + yaz (bkz. idbReplaceByIndex).
    await idbReplaceByIndex(STORES.items, "playlistId", playlistId, items);
    await idbReplaceByIndex(STORES.series, "playlistId", playlistId, series);
  }

  async clearAll() {
    await idbClear(STORES.playlists);
    await idbClear(STORES.items);
    await idbClear(STORES.series);
  }
}

const PREFERENCES_KEY = "stream-hub:preferences:v1";

class LocalStoragePreferencesRepository implements PreferencesRepository {
  async load(): Promise<UserPreferences> {
    if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;
    try {
      const raw = localStorage.getItem(PREFERENCES_KEY);
      if (!raw) return DEFAULT_PREFERENCES;
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        player: { ...DEFAULT_PREFERENCES.player, ...(parsed.player ?? {}) },
        favorites: parsed.favorites ?? {},
        watchHistory: parsed.watchHistory ?? {},
        selectedProviders: parsed.selectedProviders ?? [],
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  async save(preferences: UserPreferences): Promise<void> {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Kota dolduysa izleme geçmişini kırp ve tekrar dene.
      const trimmed: UserPreferences = {
        ...preferences,
        watchHistory: Object.fromEntries(
          Object.entries(preferences.watchHistory)
            .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
            .slice(0, 50),
        ),
      };
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(trimmed));
      } catch {
        /* sessizce vazgeç — tercihler kalıcı olmayacak ama uygulama çalışmaya devam eder */
      }
    }
  }
}

export const libraryRepository: LibraryRepository = new IndexedDbLibraryRepository();
export const preferencesRepository: PreferencesRepository = new LocalStoragePreferencesRepository();
