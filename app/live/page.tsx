"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Maximize2, Radio, Search } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import { FavoriteButton } from "@/components/content/FavoriteButton";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { SmartImage } from "@/components/ui/SmartImage";
import { EmptyState, LoadingSkeleton } from "@/components/ui/States";
import { useChannels } from "@/lib/hooks/useLibrarySelectors";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { groupChannelsByCategory } from "@/lib/library/channelCategories";
import { countryLabel } from "@/lib/m3u/classify";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useUserStore } from "@/lib/store/userStore";
import type { ContentItem } from "@/lib/types";

export default function LiveTvPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 sm:px-5 lg:px-8" />}>
      <LiveTvBrowser />
    </Suspense>
  );
}

function LiveTvBrowser() {
  const hydrated = useLibraryStore((state) => state.hydrated);
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);
  const channels = useChannels();
  const playerSettings = useUserStore((state) => state.player);

  // Ana sayfadaki "Spor / Ulusal / Haber…" kutucukları /live?category=sports'a gider.
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";

  const [category, setCategory] = useState(categoryParam);
  const [subGroup, setSubGroup] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [trackedParam, setTrackedParam] = useState(categoryParam);
  if (trackedParam !== categoryParam) {
    setTrackedParam(categoryParam);
    setCategory(categoryParam);
    setSubGroup("");
  }

  const categories = useMemo(() => groupChannelsByCategory(channels), [channels]);

  const inCategory = useMemo(() => {
    if (!category) return channels;
    return categories.find((entry) => entry.category.id === category)?.channels ?? [];
  }, [categories, category, channels]);

  // Kategori içindeki alt gruplar (sağlayıcının ham group-title'ları / ülkeler)
  const subGroups = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const channel of inCategory) {
      const key = channel.group || channel.country || "Diğer";
      const label = channel.group || (channel.country ? countryLabel(channel.country) : "Diğer");
      const entry = counts.get(key) ?? { label, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return [...counts.entries()]
      .map(([value, entry]) => ({ value, ...entry }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [inCategory]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return inCategory.filter((channel) => {
      if (subGroup && (channel.group || channel.country || "Diğer") !== subGroup) return false;
      if (normalizedQuery && !channel.title.toLocaleLowerCase("tr-TR").includes(normalizedQuery)) return false;
      return true;
    });
  }, [inCategory, subGroup, query]);

  const { visible, sentinelRef, hasMore } = usePagedList(filtered, 80);

  /**
   * Otomatik seçim YOK — bilinçli.
   *
   * IPTV hesaplarının eşzamanlı bağlantı limiti vardır (çoğu zaman 1-2). Kategori
   * her değiştiğinde listenin ilk kanalını kendiliğinden açmak bu limiti tüketip
   * kullanıcının gerçekten açmak istediği kanala 503 döndürüyordu.
   */
  const selected = useMemo(
    () => filtered.find((channel) => channel.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  if (!hydrated) {
    return (
      <div className="space-y-4 px-4 sm:px-5 pt-6 lg:px-8">
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
    <div className="px-4 pt-4 sm:px-5 sm:pt-5 lg:px-8">
      {/* Kategori sekmeleri: Spor / Ulusal / Haber / Çocuk … */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:-mx-5 sm:mb-5 sm:px-5 lg:-mx-8 lg:px-8">
        <CategoryChip
          label="Tümü"
          count={channels.length}
          color="#9A9AAD"
          active={!category}
          onClick={() => {
            setCategory("");
            setSubGroup("");
          }}
        />
        {categories.map((entry) => (
          <CategoryChip
            key={entry.category.id}
            label={entry.category.label}
            count={entry.channels.length}
            color={entry.category.color}
            active={category === entry.category.id}
            onClick={() => {
              setCategory(entry.category.id);
              setSubGroup("");
            }}
          />
        ))}
      </div>

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[220px_1fr_minmax(360px,420px)]">
        {/* Alt gruplar */}
        <aside className="order-2 min-w-0 xl:order-1 xl:sticky xl:top-[88px] xl:self-start">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-dim">
            {category ? "Alt gruplar" : "Gruplar"}
          </h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 xl:max-h-[68vh] xl:flex-col xl:overflow-y-auto">
            <GroupButton
              label="Hepsi"
              count={inCategory.length}
              active={!subGroup}
              onClick={() => setSubGroup("")}
            />
            {subGroups.map((item) => (
              <GroupButton
                key={item.value}
                label={item.label}
                count={item.count}
                active={subGroup === item.value}
                onClick={() => setSubGroup(item.value)}
              />
            ))}
          </div>
        </aside>

        {/* Kanal listesi */}
        <div className="order-3 min-w-0 xl:order-2">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kanal ara…"
              className="h-12 w-full rounded-xl border border-white/8 bg-white/[0.04] pl-10 pr-4 text-[16px] outline-none transition-colors placeholder:text-fg-dim focus:border-accent/40 sm:h-11 sm:text-[14px]"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-fg-muted">Bu filtreye uyan kanal yok.</p>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] text-fg-dim">
                {filtered.length.toLocaleString("tr-TR")} kanal
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4">
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

        {/*
          Oynatıcı mobilde DOM'da listeden ÖNCE ve yapışkan duruyor: kanal
          seçildiğinde ekranda görünüyor. Önceden yüzlerce kanalın altında
          kalıyordu ve "kanal açılmıyor" gibi görünüyordu.
        */}
        <div className="sticky top-[56px] z-20 order-1 -mx-4 min-w-0 bg-ink-950/95 px-4 pb-3 pt-1 backdrop-blur-xl sm:-mx-5 sm:top-[68px] sm:px-5 xl:order-3 xl:mx-0 xl:top-[88px] xl:self-start xl:bg-transparent xl:px-0 xl:pb-0 xl:backdrop-blur-none">
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
            <div className="hidden aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-ink-900 px-6 text-center xl:flex">
              <Radio className="h-8 w-8 text-fg-dim" />
              <p className="text-[14px] font-semibold">İzlemek için bir kanal seç</p>
              <p className="max-w-[280px] text-[12.5px] leading-relaxed text-fg-dim">
                Kanallar otomatik başlatılmıyor: IPTV hesaplarının eşzamanlı bağlantı limiti var,
                boşa açılan yayın istediğin kanalı engelleyebiliyor.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-semibold transition-all ${
        active ? "border-transparent text-white" : "border-white/8 bg-white/[0.03] text-fg-muted hover:text-fg"
      }`}
      style={active ? { background: `linear-gradient(120deg, ${color}, ${color}99)` } : undefined}
    >
      {!active && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
      <span className={active ? "text-white/70" : "text-fg-dim"}>{count.toLocaleString("tr-TR")}</span>
    </button>
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
