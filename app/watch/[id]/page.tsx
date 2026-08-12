"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";

import { VideoPlayer } from "@/components/player/VideoPlayer";
import { EmptyState } from "@/components/ui/States";
import { useContentItem } from "@/lib/hooks/useLibrarySelectors";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUserStore } from "@/lib/store/userStore";

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <WatchScreen />
    </Suspense>
  );
}

function WatchScreen() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const hydrated = useLibraryStore((state) => state.hydrated);
  const series = useLibraryStore((state) => state.series);
  const item = useContentItem(params?.id);

  const playerSettings = useUserStore((state) => state.player);
  const saveProgress = useUserStore((state) => state.saveProgress);
  const startPosition = useUserStore((state) =>
    params?.id ? (state.watchHistory[params.id]?.positionSec ?? 0) : 0,
  );

  const sourceIndex = Number(searchParams.get("source") ?? "");
  const streamUrl = useMemo(() => {
    if (!item) return "";
    if (Number.isFinite(sourceIndex) && item.sources?.[sourceIndex]) return item.sources[sourceIndex].url;
    return item.streamUrl;
  }, [item, sourceIndex]);

  const episodeContext = useMemo(() => {
    if (!item?.episodeOf) return null;
    const parent = series.find((candidate) => candidate.id === item.episodeOf!.seriesId);
    if (!parent) return null;
    const season = parent.seasons.find((candidate) => candidate.season === item.episodeOf!.season);
    const index = season?.episodes.findIndex((episode) => episode.id === item.id) ?? -1;
    const next = index >= 0 ? season?.episodes[index + 1] : undefined;
    return { parent, next };
  }, [item, series]);

  const isLive =
    item?.type === "live" || item?.type === "sports" || item?.type === "news" || item?.type === "kids";

  const handleProgress = useCallback(
    (positionSec: number, durationSec: number) => {
      if (!item) return;
      saveProgress({
        contentId: item.id,
        title: episodeContext?.parent.title ?? item.title,
        episodeLabel: item.episodeOf?.label,
        seriesId: item.episodeOf?.seriesId,
        type: item.type,
        positionSec,
        durationSec,
        logo: item.logo,
        streamUrl,
      });
    },
    [item, episodeContext, saveProgress, streamUrl],
  );

  const handleEnded = useCallback(() => {
    if (episodeContext?.next) router.push(`/watch/${episodeContext.next.id}`);
  }, [episodeContext, router]);

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  if (!hydrated) {
    return <div className="h-screen w-screen bg-black" />;
  }

  if (!item || !streamUrl) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-ink-950">
        <EmptyState
          title="Yayın bulunamadı"
          message="Bu içerik kütüphanede yok ya da stream adresi eksik."
          actionLabel="Ana sayfaya dön"
          actionHref="/"
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black">
      <VideoPlayer
        key={`${item.id}-${sourceIndex}`}
        src={streamUrl}
        title={episodeContext?.parent.title ?? item.title}
        subtitle={item.episodeOf ? `${item.episodeOf.label} · ${item.group}` : item.group}
        isLive={isLive}
        autoPlay={playerSettings.autoplay}
        startPosition={playerSettings.rememberPosition ? startPosition : 0}
        preferredQuality={playerSettings.defaultQuality}
        useProxy={playerSettings.useStreamProxy}
        onBack={goBack}
        onProgress={isLive ? undefined : handleProgress}
        onEnded={handleEnded}
      />
    </div>
  );
}
