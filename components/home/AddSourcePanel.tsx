"use client";

import { ChevronDown, Plus, Radio } from "lucide-react";
import { useState } from "react";

import { SourceForm } from "@/components/playlist/SourceForm";
import { useLibraryStore } from "@/lib/store/libraryStore";

/**
 * Ana sayfanın en üstündeki kaynak ekleme paneli.
 *
 * Kütüphane boşken açık gelir (uygulamanın ilk işi liste eklemek), doluyken
 * tek satıra katlanır ve dokununca açılır. Menüyü aramaya gerek kalmadan
 * ana sayfadan M3U eklenebiliyor.
 */
export function AddSourcePanel() {
  const playlists = useLibraryStore((state) => state.playlists);
  const isDemo = useLibraryStore((state) => state.isDemo);
  const hasRealPlaylist = playlists.length > 0 && !isDemo;

  const [expanded, setExpanded] = useState(!hasRealPlaylist);

  // Liste eklenince paneli kendiliğinden kapat (render sırasında, effect'siz).
  const [trackedHasPlaylist, setTrackedHasPlaylist] = useState(hasRealPlaylist);
  if (trackedHasPlaylist !== hasRealPlaylist) {
    setTrackedHasPlaylist(hasRealPlaylist);
    setExpanded(!hasRealPlaylist);
  }

  return (
    <section className="px-4 pt-4 sm:px-5 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-accent/12 via-violet/10 to-transparent">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/90 text-white shadow-[var(--shadow-accent)]">
            {hasRealPlaylist ? <Plus className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold tracking-tight sm:text-[17px]">
              {hasRealPlaylist ? "Yeni kaynak ekle" : "M3U listeni ekle"}
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-fg-muted">
              M3U URL · Panel girişi · Dosya yükle · Demo içerik
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-fg-muted transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {expanded && (
          <div className="border-t border-white/8 bg-ink-950/40 p-4 sm:p-5">
            <SourceForm />
          </div>
        )}
      </div>
    </section>
  );
}
