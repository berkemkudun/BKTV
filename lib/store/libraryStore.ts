"use client";

import { create } from "zustand";

import { DEMO_PLAYLIST_ID, buildDemoM3U } from "@/lib/demo/demoPlaylist";
import { buildLibraryFromEntries, mergeLibraries } from "@/lib/library/build";
import { parseM3UChunked } from "@/lib/m3u/parser";
import { libraryRepository } from "@/lib/storage/repository";
import type { ContentItem, Library, LibraryProvider, Playlist, SeriesItem } from "@/lib/types";
import { randomId } from "@/lib/utils/id";

export type LoadStage = "idle" | "downloading" | "parsing" | "analyzing" | "saving" | "done" | "error";

interface LoadState {
  stage: LoadStage;
  message: string;
  parsed: number;
  error?: string;
}

interface LibraryState {
  hydrated: boolean;
  isDemo: boolean;
  playlists: Playlist[];
  items: ContentItem[];
  series: SeriesItem[];
  providers: LibraryProvider[];
  counts: Library["counts"];
  load: LoadState;

  hydrate: () => Promise<void>;
  addFromUrl: (url: string, name?: string) => Promise<void>;
  addFromText: (text: string, name: string) => Promise<void>;
  refreshPlaylist: (playlistId: string) => Promise<void>;
  removePlaylist: (playlistId: string) => Promise<void>;
  loadDemo: () => Promise<void>;
  resetLoadState: () => void;
}

const EMPTY_COUNTS: Library["counts"] = {
  movie: 0,
  series: 0,
  live: 0,
  sports: 0,
  news: 0,
  kids: 0,
  other: 0,
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  hydrated: false,
  isDemo: false,
  playlists: [],
  items: [],
  series: [],
  providers: [],
  counts: EMPTY_COUNTS,
  load: { stage: "idle", message: "", parsed: 0 },

  resetLoadState: () => set({ load: { stage: "idle", message: "", parsed: 0 } }),

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [playlists, items, series] = await Promise.all([
        libraryRepository.listPlaylists(),
        libraryRepository.listItems(),
        libraryRepository.listSeries(),
      ]);

      if (playlists.length === 0) {
        set({ hydrated: true });
        await get().loadDemo();
        return;
      }

      const library = mergeLibraries([{ items, series }]);
      set({
        hydrated: true,
        isDemo: false,
        playlists,
        items: library.items,
        series: library.series,
        providers: library.providers,
        counts: library.counts,
      });
    } catch {
      // IndexedDB kullanılamıyorsa (gizli sekme, eski tarayıcı) demo moda düş.
      set({ hydrated: true });
      await get().loadDemo();
    }
  },

  loadDemo: async () => {
    const entries = await parseM3UChunked(buildDemoM3U());
    const built = buildLibraryFromEntries(entries, DEMO_PLAYLIST_ID);
    const library = mergeLibraries([built]);
    set({
      isDemo: true,
      playlists: [
        {
          id: DEMO_PLAYLIST_ID,
          name: "Demo İçerik",
          source: "demo",
          lastUpdated: Date.now(),
          itemCount: library.items.length,
        },
      ],
      items: library.items,
      series: library.series,
      providers: library.providers,
      counts: library.counts,
      load: { stage: "done", message: "Demo içerik yüklendi", parsed: library.items.length },
    });
  },

  addFromUrl: async (url, name) => {
    set({ load: { stage: "downloading", message: "Playlist indiriliyor…", parsed: 0 } });

    let text: string;
    try {
      const response = await fetch("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error ?? "Playlist indirilemedi");
      text = data.text;
    } catch (error) {
      set({
        load: {
          stage: "error",
          message: "",
          parsed: 0,
          error: error instanceof Error ? error.message : "Playlist indirilemedi",
        },
      });
      throw error;
    }

    await ingest(text, {
      id: randomId("pl"),
      name: name?.trim() || guessName(url),
      url,
      source: "url",
    });
  },

  addFromText: async (text, name) => {
    await ingest(text, { id: randomId("pl"), name, source: "file" });
  },

  refreshPlaylist: async (playlistId) => {
    const playlist = get().playlists.find((item) => item.id === playlistId);
    if (!playlist?.url) throw new Error("Bu playlist bir URL'den gelmediği için yenilenemez");

    set({ load: { stage: "downloading", message: "Playlist yenileniyor…", parsed: 0 } });
    const response = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: playlist.url }),
    });
    const data = (await response.json()) as { text?: string; error?: string };
    if (!response.ok || !data.text) {
      const message = data.error ?? "Playlist yenilenemedi";
      set({ load: { stage: "error", message: "", parsed: 0, error: message } });
      throw new Error(message);
    }

    await ingest(data.text, playlist);
  },

  removePlaylist: async (playlistId) => {
    if (playlistId === DEMO_PLAYLIST_ID) {
      set({ playlists: [], items: [], series: [], providers: [], counts: EMPTY_COUNTS, isDemo: false });
      return;
    }
    await libraryRepository.deletePlaylist(playlistId);
    const [playlists, items, series] = await Promise.all([
      libraryRepository.listPlaylists(),
      libraryRepository.listItems(),
      libraryRepository.listSeries(),
    ]);

    if (playlists.length === 0) {
      set({ playlists: [], items: [], series: [], providers: [], counts: EMPTY_COUNTS });
      await get().loadDemo();
      return;
    }

    const library = mergeLibraries([{ items, series }]);
    set({
      playlists,
      items: library.items,
      series: library.series,
      providers: library.providers,
      counts: library.counts,
    });
  },
}));

/** İndirilmiş M3U metnini parse edip kütüphaneye işler ve kalıcı olarak saklar. */
async function ingest(text: string, playlistMeta: Omit<Playlist, "lastUpdated" | "itemCount">) {
  const set = useLibraryStore.setState;
  const get = useLibraryStore.getState;

  set({ load: { stage: "parsing", message: "M3U ayrıştırılıyor…", parsed: 0 } });

  const entries = await parseM3UChunked(text, (parsed) => {
    set({ load: { stage: "parsing", message: "M3U ayrıştırılıyor…", parsed } });
  });

  if (entries.length === 0) {
    set({
      load: { stage: "error", message: "", parsed: 0, error: "Listede geçerli kayıt bulunamadı" },
    });
    throw new Error("Listede geçerli kayıt bulunamadı");
  }

  set({ load: { stage: "analyzing", message: "İçerikler analiz ediliyor…", parsed: entries.length } });
  await nextTick();

  const built = buildLibraryFromEntries(entries, playlistMeta.id);

  set({ load: { stage: "saving", message: "Kaydediliyor…", parsed: entries.length } });

  const playlist: Playlist = {
    ...playlistMeta,
    lastUpdated: Date.now(),
    itemCount: built.items.length,
  };

  let persisted = true;
  try {
    await libraryRepository.savePlaylist(playlist);
    await libraryRepository.replacePlaylistContent(playlist.id, built.items, built.series);
  } catch {
    persisted = false; // IndexedDB yoksa oturum boyunca bellekte tut
  }

  const wasDemo = get().isDemo;
  const otherPlaylists = wasDemo ? [] : get().playlists.filter((item) => item.id !== playlist.id);
  const otherItems = wasDemo ? [] : get().items.filter((item) => item.playlistId !== playlist.id);
  const otherSeries = wasDemo ? [] : get().series.filter((item) => item.playlistId !== playlist.id);

  const library = mergeLibraries([{ items: otherItems, series: otherSeries }, built]);

  set({
    isDemo: false,
    playlists: [...otherPlaylists, playlist],
    items: library.items,
    series: library.series,
    providers: library.providers,
    counts: library.counts,
    load: {
      stage: "done",
      message: persisted
        ? `${built.items.length.toLocaleString("tr-TR")} içerik hazır`
        : `${built.items.length.toLocaleString("tr-TR")} içerik yüklendi (kalıcı depolama kullanılamadı)`,
      parsed: entries.length,
    },
  });
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function guessName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Playlist";
  }
}
