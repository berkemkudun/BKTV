"use client";

import Link from "next/link";
import { Maximize2, Radio, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { FavoriteButton } from "@/components/content/FavoriteButton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { SmartImage } from "@/components/ui/SmartImage";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { useChannels } from "@/lib/hooks/useLibrarySelectors";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { countryLabel } from "@/lib/m3u/classify";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useUserStore } from "@/lib/store/userStore";
import type { ContentItem } from "@/lib/types";

export default function LiveTvPage() {
  const hydrated = useLibraryStore((state) => state.hydrated);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);
  const channels = useChannels();
  const playerSettings = useUserStore((state) => state.player);

  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Gruplar: ülke bilgisi varsa ülkeye, yoksa ham group-title'a göre
  const groups = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const channel of channels) {
      const key = channel.country ?? channel.group ?? "Diğer";
      const label = channel.country ? countryLabel(channel.country) : channel.group || "Diğer";
      const entry = counts.get(key) ?? { label, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return [...counts.entries()]
      .map(([value, entry]) => ({ value, ...entry }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);
  }, [channels]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return channels.filter((channel) => {
      const key = channel.country ?? channel.group ?? "Diğer";
      if (group && key !== group) return false;
      if (normalizedQuery && !channel.title.toLocaleLowerCase("tr-TR").includes(normalizedQuery)) return false;
      return true;
    });
  }, [channels, group, query]);

  const { visible, sentinelRef, hasMore } = usePagedList(filtered, 80);

  // Seçili kanal id üzerinden türetiliyor: filtre değişince listedeki ilk kanala düşer.
  const selected = useMemo(
    () => filtered.find((channel) => channel.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  if (!hydrated) {
    return (
      <div className="space-y-4 px-5 pt-6 lg:px-8">
        <LoadingSkeleton className="h-11 w-full max-w-sm" />
        <LoadingSkeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <EmptyState
        title="Canlı kanal yok"
        message="Playlistinde canlı yayın olarak sınıflandırılan içerik bulunamadı."
        actionLabel="Playlist Ekle"
        onAction={openPlaylistDialog}
      />
    );
  }

  return (
    <div className="grid gap-6 px-5 pt-5 lg:px-8 xl:grid-cols-[220px_1fr_minmax(360px,420px)]">
      {/* Gruplar */}
      <aside className="xl:sticky xl:top-[88px] xl:self-start">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-dim">Gruplar</h2>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 xl:max-h-[70vh] xl:flex-col xl:overflow-y-auto">
          <GroupButton label="Tüm Kanallar" count={channels.length} active={!group} onClick={() => setGroup("")} />
          {groups.map((item) => (
            <GroupButton
              key={item.value}
              label={item.label}
              count={item.count}
              active={group === item.value}
              onClick={() => setGroup(item.value)}
            />
          ))}
        </div>
      </aside>

      {/* Kanal listesi */}
      <div className="min-w-0">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kanal ara…"
            className="h-11 w-full rounded-xl border border-white/8 bg-white/[0.04] pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-fg-dim focus:border-accent/40"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-fg-muted">Bu filtreye uyan kanal yok.</p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {visible.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  active={selected?.id === channel.id}
                  onSelect={() => setSelectedId(channel.id)}
                />
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} className="h-20" />}
          </>
        )}
      </div>

      {/* Oynatıcı */}
      <div className="xl:sticky xl:top-[88px] xl:self-start">
        {selected ? (
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-ink-900">
            <div className="aspect-video w-full bg-black">
              <VideoPlayer
                key={selected.id}
                src={selected.streamUrl}
                title={selected.title}
                subtitle={selected.group}
                isLive
                autoPlay={playerSettings.autoplay}
                useProxy={playerSettings.useStreamProxy}
                preferredQuality={playerSettings.defaultQuality}
              />
            </div>
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-bold">{selected.title}</h3>
                <p className="truncate text-[12.5px] text-fg-dim">{selected.group}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <FavoriteButton
                  id={selected.id}
                  title={selected.title}
                  type={selected.type}
                  logo={selected.logo}
                />
                <Link
                  href={`/watch/${selected.id}`}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/8 transition-colors hover:bg-white/15"
                  aria-label="Tam ekranda aç"
                >
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid aspect-video place-items-center rounded-2xl border border-white/8 bg-ink-900 text-fg-dim">
            <Radio className="h-8 w-8" />
          </div>
        )}
      </div>
    </div>
  );
}

function GroupButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors xl:w-full ${
        active ? "bg-accent text-white" : "text-fg-muted hover:bg-white/5 hover:text-fg"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`shrink-0 text-[11.5px] ${active ? "text-white/70" : "text-fg-dim"}`}>{count}</span>
    </button>
  );
}

function ChannelCard({
  channel,
  active,
  onSelect,
}: {
  channel: ContentItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
        active
          ? "border-accent/60 bg-accent/10"
          : "border-white/8 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/20"
      }`}
    >
      <SmartImage
        src={channel.logo}
        alt={channel.title}
        fallbackText={channel.title}
        className="mb-2.5 aspect-video w-full rounded-lg"
        fit="contain"
      />
      <p className="truncate text-[13px] font-semibold">{channel.title}</p>
      <p className="truncate text-[11.5px] text-fg-dim">{channel.group}</p>
    </button>
  );
}
