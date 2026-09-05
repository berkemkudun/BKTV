"use client";

import {
  AlertTriangle,
  ChevronLeft,
  Languages,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Subtitles,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import type Hls from "hls.js";
import type MpegtsPlayerType from "mpegts.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type Diagnosis, diagnose, probeStream } from "@/lib/player/diagnose";
import { type StreamCandidate, buildSourceCandidates, detectEnvironment } from "@/lib/player/stream";
import { languageLabel, subtitleFileToUrl } from "@/lib/player/subtitles";

export interface VideoPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  /** Canlı yayında ilerleme çubuğu ve kaldığı yerden devam kapatılır */
  isLive?: boolean;
  autoPlay?: boolean;
  /** Kaldığı yerden devam (saniye) */
  startPosition?: number;
  /** Varsayılan kalite tercihi; HLS seviyelerinden en yakını seçilir */
  preferredQuality?: "auto" | "1080" | "720" | "480";
  /** Önce proxy'li kaynakları dene */
  useProxy?: boolean;
  onBack?: () => void;
  /** Saniyede bir değil, ~5 saniyede bir çağrılır */
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
}

interface TrackOption {
  id: number;
  label: string;
}

const QUALITY_HEIGHTS: Record<string, number> = { "1080": 1080, "720": 720, "480": 480 };

export function VideoPlayer({
  src,
  title,
  subtitle,
  isLive = false,
  autoPlay = true,
  startPosition = 0,
  preferredQuality = "auto",
  useProxy = false,
  onBack,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<ReturnType<typeof MpegtsPlayerType.createPlayer> | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReport = useRef(0);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  /**
   * Kaynak sökülürken video.load() "Empty src attribute" hatası fırlatır.
   * Bu bayrak olmadan o hata "kaynak çalışmıyor" sanılıp sıradaki adaya geçilirdi.
   */
  const tearingDown = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  /** Otomatik oynatma sesli reddedilince sessize aldık: kullanıcıya söylemek gerekiyor. */
  const [autoMuted, setAutoMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  /** Tarayıcının kendi hata metni — kodek sorunlarını ayırt etmek için tanıya besleniyor. */
  const [mediaErrorMessage, setMediaErrorMessage] = useState<string | undefined>(undefined);

  const [levels, setLevels] = useState<TrackOption[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [autoLevel, setAutoLevel] = useState(true);
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([]);
  const [activeAudio, setActiveAudio] = useState(-1);
  const [embeddedSubs, setEmbeddedSubs] = useState<TrackOption[]>([]);
  const [activeSub, setActiveSub] = useState(-1);
  const [externalSubs, setExternalSubs] = useState<{ label: string; url: string }[]>([]);
  const [activeExternalSub, setActiveExternalSub] = useState(-1);

  const [menu, setMenu] = useState<"quality" | "audio" | "subs" | null>(null);

  // ---- Kaynak adayları: HLS varyantı → doğrudan → proxy ------------------
  const candidates = useMemo(() => buildSourceCandidates(src, useProxy), [src, useProxy]);
  /** Sayfa https, yayın http: doğrudan bağlantı tarayıcıda engellenir — kullanıcıya söylüyoruz. */
  const mixedContent = useMemo(
    () => typeof window !== "undefined" && detectEnvironment(src).insecurePage,
    [src],
  );
  /** Uygulama uzak bir sunucuda mı? 403/404 tanısı buna göre tamamen değişiyor. */
  const hosted = useMemo(
    () =>
      typeof window !== "undefined" &&
      !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(window.location.hostname) &&
      !/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname),
    [],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  // src değişince aday zincirini render sırasında başa sar.
  const [trackedSrc, setTrackedSrc] = useState(src);
  if (trackedSrc !== src) {
    setTrackedSrc(src);
    setCandidateIndex(0);
    setMediaErrorMessage(undefined);
  }

  /**
   * Aday index'i listenin sonunu geçtiyse denenecek kaynak kalmamıştır.
   * "failed" ayrı bir state değil: iki state'i senkron tutmak yerine tek
   * sayaçtan türetiliyor (hata ekranı ile aday zinciri asla ayrışmıyor).
   */
  const failed = candidateIndex >= candidates.length;
  const candidate: StreamCandidate | undefined = candidates[candidateIndex];

  /** Bu adayda hata alındı: sıradakine geç. */
  const failCandidate = useCallback(() => {
    setCandidateIndex((index) => index + 1);
  }, []);

  // ---- Motoru bağla ------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !candidate) return;

    let disposed = false;
    tearingDown.current = false;

    /**
     * Bekçi: bazı IPTV adresleri bağlantıyı açık tutup hiç veri göndermiyor.
     * Bu durumda ne "error" olayı ne de hls.js hatası gelir; ekran sonsuza kadar
     * dönen bir spinner'da kalırdı. 15 saniyede ilk kare gelmezse sıradaki adaya geç.
     */
    let watchdog: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      watchdog = null;
      if (disposed) return;
      if (video.readyState >= 2) return;
      failCandidate();
    }, 15000);

    const clearWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = null;
    };
    video.addEventListener("loadeddata", clearWatchdog);
    video.addEventListener("playing", clearWatchdog);
    setBuffering(true);
    setLevels([]);
    setAudioTracks([]);
    setEmbeddedSubs([]);
    setActiveSub(-1);

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        try {
          mpegtsRef.current.destroy();
        } catch {
          /* zaten kapanmış */
        }
        mpegtsRef.current = null;
      }
    };

    /**
     * Tarayıcılar sesli otomatik oynatmayı engelliyor: play() reddedilince
     * yayını "açılmadı" saymak yerine sessize alıp bir kez daha deniyoruz.
     */
    const attemptPlay = () => {
      if (!autoPlay) return;
      void video.play().catch(() => {
        video.muted = true;
        setMuted(true);
        setAutoMuted(true);
        void video.play().catch(() => setPlaying(false));
      });
    };

    const startNative = () => {
      video.src = candidate.url;
      if (startPosition > 0 && !isLive) video.currentTime = startPosition;
      attemptPlay();
    };

    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (candidate.kind === "hls" && !nativeHls) {
      void (async () => {
        const HlsModule = (await import("hls.js")).default;
        if (disposed) return;
        if (!HlsModule.isSupported()) {
          startNative();
          return;
        }

        const hls = new HlsModule({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60,
          maxBufferLength: 30,
          manifestLoadingTimeOut: 20000,
          fragLoadingTimeOut: 30000,
        });
        hlsRef.current = hls;

        hls.on(HlsModule.Events.MANIFEST_PARSED, (_event, data) => {
          setLevels(
            data.levels
              .map((level, index) => ({ id: index, label: `${level.height ?? 0}p` }))
              .filter((level) => level.label !== "0p"),
          );

          if (preferredQuality !== "auto") {
            const target = QUALITY_HEIGHTS[preferredQuality];
            let best = -1;
            let bestDiff = Number.POSITIVE_INFINITY;
            data.levels.forEach((level, index) => {
              const diff = Math.abs((level.height ?? 0) - target);
              if (diff < bestDiff) {
                bestDiff = diff;
                best = index;
              }
            });
            if (best >= 0) {
              hls.currentLevel = best;
              setAutoLevel(false);
            }
          }

          if (startPosition > 0 && !isLive) video.currentTime = startPosition;
          attemptPlay();
        });

        // Ses ve altyazı parçaları manifest içinde gelir.
        hls.on(HlsModule.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
          setAudioTracks(
            data.audioTracks.map((track, index) => ({
              id: index,
              label: languageLabel(track.lang, track.name || `Ses ${index + 1}`),
            })),
          );
          setActiveAudio(hls.audioTrack);
        });

        hls.on(HlsModule.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
          setEmbeddedSubs(
            data.subtitleTracks.map((track, index) => ({
              id: index,
              label: languageLabel(track.lang, track.name || `Altyazı ${index + 1}`),
            })),
          );
        });

        hls.on(HlsModule.Events.LEVEL_SWITCHED, (_event, data) => setCurrentLevel(data.level));

        /**
         * Canlı yayında tek bir segment hatası tüm zinciri düşürmemeli: yayın
         * başladıktan sonraki ağ hatasında bir kez toparlanmayı dene.
         * Manifest hiç yüklenemediyse (CORS / 503) beklemenin anlamı yok —
         * hemen sıradaki adaya geçilir.
         */
        let networkRetried = false;
        hls.on(HlsModule.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === HlsModule.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          const manifestFailed =
            data.details === HlsModule.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === HlsModule.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === HlsModule.ErrorDetails.MANIFEST_PARSING_ERROR;
          if (data.type === HlsModule.ErrorTypes.NETWORK_ERROR && !manifestFailed && !networkRetried) {
            networkRetried = true;
            hls.startLoad();
            return;
          }
          cleanup();
          failCandidate();
        });

        hls.loadSource(candidate.url);
        hls.attachMedia(video);
      })();
    } else if (candidate.kind === "mpegts") {
      void (async () => {
        const mpegts = (await import("mpegts.js")).default;
        if (disposed) return;
        if (!mpegts.isSupported()) {
          failCandidate();
          return;
        }

        const player = mpegts.createPlayer(
          { type: "mpegts", isLive: true, url: candidate.url },
          {
            // enableWorker kapalı: worker kodu Blob olarak üretiliyor ve bundler'ın
            // dönüştürdüğü modül referansları worker içinde çözülemiyor
            // ("… is not a constructor"). Ana thread'de sorunsuz çalışıyor.
            enableWorker: false,
            liveBufferLatencyChasing: true,
            lazyLoad: false,
            fixAudioTimestampGap: true,
            // Stash buffer ilk kareyi geciktiriyor; canlı yayında görüntü
            // gelene kadar geçen süre belirgin şekilde kısalıyor.
            enableStashBuffer: false,
            stashInitialSize: 128,
          },
        );
        mpegtsRef.current = player;

        player.on(mpegts.Events.ERROR, () => {
          cleanup();
          failCandidate();
        });

        player.attachMediaElement(video);
        player.load();
        attemptPlay();
      })();
    } else {
      startNative();
    }

    return () => {
      disposed = true;
      tearingDown.current = true;
      clearWatchdog();
      video.removeEventListener("loadeddata", clearWatchdog);
      video.removeEventListener("playing", clearWatchdog);
      cleanup();
      video.removeAttribute("src");
      video.load();
    };
    // startPosition kasıtlı olarak dependency değil: her seek'te kaynağı yeniden bağlamamalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.url, candidate?.kind, isLive, autoPlay, preferredQuality, failCandidate]);

  // ---- Video olayları ---------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onLoaded = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setBuffering(false);
    };
    const onTime = () => {
      setPosition(video.currentTime);
      if (isLive || !onProgress) return;
      const now = Date.now();
      if (now - lastReport.current > 5000 && video.duration > 0) {
        lastReport.current = now;
        onProgress(video.currentTime, video.duration);
      }
    };
    const onVideoError = () => {
      // Sökme sırasındaki "Empty src attribute" hatasını gerçek yayın hatası sanma.
      if (tearingDown.current) return;
      if (video.networkState === video.NETWORK_EMPTY) return;
      if (video.error?.message) setMediaErrorMessage(video.error.message);
      failCandidate();
    };
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
      // Kullanıcı sesi kendisi açtıysa "sessiz başladı" uyarısı kalkmalı.
      if (!video.muted) setAutoMuted(false);
    };
    const onEndedEvent = () => onEnded?.();

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("durationchange", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("error", onVideoError);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ended", onEndedEvent);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("durationchange", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("error", onVideoError);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ended", onEndedEvent);
    };
  }, [isLive, onProgress, onEnded, failCandidate]);

  // Sayfadan ayrılırken son konumu bildir.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video || isLive || !onProgress) return;
      if (video.duration > 0 && video.currentTime > 5) onProgress(video.currentTime, video.duration);
    };
  }, [isLive, onProgress]);

  // ---- Altyazı seçimi ---------------------------------------------------
  const selectEmbeddedSub = useCallback((id: number) => {
    setActiveSub(id);
    setActiveExternalSub(-1);
    if (hlsRef.current) {
      hlsRef.current.subtitleDisplay = id >= 0;
      hlsRef.current.subtitleTrack = id;
    }
    const video = videoRef.current;
    if (video) {
      for (const track of Array.from(video.textTracks)) track.mode = "disabled";
    }
  }, []);

  const selectExternalSub = useCallback((index: number) => {
    setActiveExternalSub(index);
    setActiveSub(-1);
    if (hlsRef.current) {
      hlsRef.current.subtitleDisplay = false;
      hlsRef.current.subtitleTrack = -1;
    }
    const video = videoRef.current;
    if (!video) return;
    // <track> elemanları externalSubs sırasıyla render ediliyor.
    Array.from(video.textTracks).forEach((track, trackIndex) => {
      track.mode = trackIndex === index ? "showing" : "disabled";
    });
  }, []);

  const selectAudio = useCallback((id: number) => {
    setActiveAudio(id);
    if (hlsRef.current) hlsRef.current.audioTrack = id;
  }, []);

  const addSubtitleFile = useCallback(
    async (file: File) => {
      try {
        const url = await subtitleFileToUrl(file);
        const label = file.name.replace(/\.(srt|vtt)$/i, "");
        setExternalSubs((current) => [...current, { label, url }]);
        // Yeni eklenen parça DOM'a girdikten sonra seçilebilir.
        setTimeout(() => selectExternalSub(externalSubs.length), 50);
      } catch {
        /* okunamayan dosya sessizce yok sayılır */
      }
    },
    [externalSubs.length, selectExternalSub],
  );

  // ---- Kontroller -------------------------------------------------------
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch {
      /* fullscreen reddedildi — sessizce yok say */
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 3200);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setControlsVisible(false), 3200);
    hideControlsTimer.current = timer;
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      const video = videoRef.current;
      if (!video) return;

      switch (event.key) {
        case " ":
        case "k":
        case "Enter":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          event.preventDefault();
          seekBy(10);
          break;
        case "ArrowLeft":
          event.preventDefault();
          seekBy(-10);
          break;
        case "ArrowUp":
          event.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          event.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case "f":
          void toggleFullscreen();
          break;
        default:
          break;
      }
      showControls();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen, showControls]);

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const hasSubs = embeddedSubs.length > 0 || externalSubs.length > 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={showControls}
      onTouchStart={showControls}
      className={`relative h-full w-full overflow-hidden bg-black ${
        controlsVisible || !playing ? "cursor-default" : "cursor-none"
      }`}
    >
      {/*
        crossOrigin bilinçli olarak set edilmiyor: düz MP4/TS kaynaklarının çoğu CORS
        başlığı göndermez ve "anonymous" bu yayınların hiç açılmamasına yol açar.
      */}
      <video ref={videoRef} onClick={togglePlay} playsInline className="h-full w-full bg-black">
        {externalSubs.map((track, index) => (
          <track
            key={track.url}
            kind="subtitles"
            src={track.url}
            label={track.label}
            default={index === activeExternalSub}
          />
        ))}
      </video>

      {autoMuted && muted && !failed && (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = false;
            setAutoMuted(false);
            void video.play().catch(() => {});
          }}
          className="absolute left-1/2 top-[68px] z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-[13px] font-semibold backdrop-blur-sm"
        >
          <VolumeX className="h-4 w-4" /> Ses kapalı başladı — açmak için dokun
        </button>
      )}

      {!playing && !buffering && !failed && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Oynat"
          className="absolute inset-0 z-10 grid place-items-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 ring-1 ring-white/25 backdrop-blur-sm">
            <Play className="h-7 w-7 translate-x-[2px] fill-white text-white" />
          </span>
        </button>
      )}

      {buffering && !failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-12 w-12 animate-spin text-white/80" />
        </div>
      )}

      {failed && (
        <FailureScreen
          src={src}
          mediaErrorMessage={mediaErrorMessage}
          mixedContent={mixedContent}
          hosted={hosted}
          onBack={onBack}
          onRetry={() => setCandidateIndex(0)}
          onRetryWithProxy={() => {
            const proxyIndex = candidates.findIndex((item) => item.viaProxy);
            if (proxyIndex >= 0) setCandidateIndex(proxyIndex);
          }}
        />
      )}

      {/* Üst bar */}
      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-start gap-3 bg-gradient-to-b from-black/85 to-transparent p-4 pt-[max(16px,env(safe-area-inset-top))] transition-opacity duration-300 sm:gap-4 sm:p-5 ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/50 backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label="Geri"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold sm:text-[18px]">{title}</h1>
          {subtitle && <p className="truncate text-[12px] text-fg-muted sm:text-[13px]">{subtitle}</p>}
        </div>
        {isLive && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Canlı
          </span>
        )}
      </div>

      {/* Alt kontroller — hata ekranı açıkken gizlenir (tanı metnini örtüyordu) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-14 transition-opacity duration-300 sm:px-5 sm:pb-5 sm:pt-16 ${
          controlsVisible && !failed ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {!isLive && (
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={position}
              onChange={(event) => {
                const video = videoRef.current;
                if (video) video.currentTime = Number(event.target.value);
              }}
              aria-label="İlerleme"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
              style={{
                background: `linear-gradient(to right, var(--color-accent) ${progressPercent}%, rgba(255,255,255,0.22) ${progressPercent}%)`,
              }}
            />
            <div className="mt-1.5 flex justify-between text-[12px] font-medium tabular-nums text-fg-muted">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ControlButton onClick={togglePlay} label={playing ? "Duraklat" : "Oynat"}>
            {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
          </ControlButton>

          {!isLive && (
            <>
              <ControlButton onClick={() => seekBy(-10)} label="10 saniye geri">
                <RotateCcw className="h-[18px] w-[18px]" />
              </ControlButton>
              <ControlButton onClick={() => seekBy(10)} label="10 saniye ileri">
                <RotateCw className="h-[18px] w-[18px]" />
              </ControlButton>
            </>
          )}

          <div className="group/volume flex items-center gap-2 max-sm:gap-0">
            <ControlButton
              onClick={() => {
                const video = videoRef.current;
                if (video) video.muted = !video.muted;
              }}
              label={muted ? "Sesi aç" : "Sessize al"}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-[18px] w-[18px]" />
              ) : (
                <Volume2 className="h-[18px] w-[18px]" />
              )}
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                video.volume = Number(event.target.value);
                video.muted = Number(event.target.value) === 0;
              }}
              aria-label="Ses seviyesi"
              className="hidden h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 opacity-0 transition-all duration-300 group-hover/volume:w-20 group-hover/volume:opacity-100 sm:block [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Ses dili */}
            {audioTracks.length > 1 && (
              <MenuButton
                open={menu === "audio"}
                onToggle={() => setMenu(menu === "audio" ? null : "audio")}
                label="Ses dili"
                icon={<Languages className="h-[18px] w-[18px]" />}
              >
                {audioTracks.map((track) => (
                  <MenuOption
                    key={track.id}
                    label={track.label}
                    active={activeAudio === track.id}
                    onClick={() => {
                      selectAudio(track.id);
                      setMenu(null);
                    }}
                  />
                ))}
              </MenuButton>
            )}

            {/* Altyazı */}
            <MenuButton
              open={menu === "subs"}
              onToggle={() => setMenu(menu === "subs" ? null : "subs")}
              label="Altyazı"
              icon={
                <Subtitles
                  className={`h-[18px] w-[18px] ${
                    activeSub >= 0 || activeExternalSub >= 0 ? "text-accent" : ""
                  }`}
                />
              }
            >
              <MenuOption
                label="Kapalı"
                active={activeSub === -1 && activeExternalSub === -1}
                onClick={() => {
                  selectEmbeddedSub(-1);
                  setMenu(null);
                }}
              />
              {embeddedSubs.map((track) => (
                <MenuOption
                  key={`embedded-${track.id}`}
                  label={track.label}
                  active={activeSub === track.id}
                  onClick={() => {
                    selectEmbeddedSub(track.id);
                    setMenu(null);
                  }}
                />
              ))}
              {externalSubs.map((track, index) => (
                <MenuOption
                  key={track.url}
                  label={track.label}
                  active={activeExternalSub === index}
                  onClick={() => {
                    selectExternalSub(index);
                    setMenu(null);
                  }}
                />
              ))}
              {!hasSubs && (
                <p className="px-4 py-2.5 text-[12px] leading-relaxed text-fg-dim">
                  Bu yayında gömülü altyazı yok.
                </p>
              )}
              <button
                type="button"
                onClick={() => subtitleInputRef.current?.click()}
                className="flex w-full items-center gap-2 border-t border-white/8 px-4 py-2.5 text-left text-[13px] font-medium text-fg-muted transition-colors hover:bg-white/8 hover:text-fg"
              >
                <Upload className="h-3.5 w-3.5" /> .srt / .vtt yükle
              </button>
            </MenuButton>

            <input
              ref={subtitleInputRef}
              type="file"
              accept=".srt,.vtt,text/vtt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void addSubtitleFile(file);
                event.target.value = "";
              }}
            />

            {/* Kalite */}
            {levels.length > 1 && (
              <MenuButton
                open={menu === "quality"}
                onToggle={() => setMenu(menu === "quality" ? null : "quality")}
                label="Kalite"
                icon={<Settings2 className="h-[18px] w-[18px]" />}
              >
                <MenuOption
                  label="Otomatik"
                  active={autoLevel}
                  onClick={() => {
                    if (hlsRef.current) hlsRef.current.currentLevel = -1;
                    setAutoLevel(true);
                    setMenu(null);
                  }}
                />
                {levels.map((level) => (
                  <MenuOption
                    key={level.id}
                    label={level.label}
                    active={!autoLevel && currentLevel === level.id}
                    onClick={() => {
                      if (hlsRef.current) hlsRef.current.currentLevel = level.id;
                      setAutoLevel(false);
                      setMenu(null);
                    }}
                  />
                ))}
              </MenuButton>
            )}

            <ControlButton onClick={toggleFullscreen} label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}>
              {fullscreen ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tüm kaynak adayları tükendiğinde gösterilen tanı ekranı.
 * Tahmin yürütmez: adresi sunucudan yoklar (/api/probe) ve tarayıcının kendi
 * MediaError mesajıyla birleştirip somut bir sebep gösterir.
 */
function FailureScreen({
  src,
  mediaErrorMessage,
  mixedContent,
  hosted,
  onBack,
  onRetry,
  onRetryWithProxy,
}: {
  src: string;
  mediaErrorMessage?: string;
  /** Sayfa https, yayın http: doğrudan bağlantı zaten tarayıcı tarafından engellendi */
  mixedContent?: boolean;
  /** Uygulama uzak bir sunucuda çalışıyor (localhost değil) */
  hosted?: boolean;
  onBack?: () => void;
  onRetry: () => void;
  onRetryWithProxy: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    probeStream(src).then((probe) => {
      if (!cancelled) {
        setDiagnosis(
          diagnose(src, mediaErrorMessage, probe, {
            hosted: Boolean(hosted),
            mixedContent: Boolean(mixedContent),
          }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, mediaErrorMessage, hosted, mixedContent]);

  /*
   * Kutu küçük olabilir (Canlı TV'de oynatıcı 16:9 bir karttır): metin
   * kaydırılabilir olmalı, aksi halde tanı yazısı kırpılıyor ve alttaki
   * kontrol çubuğunun altında kalıyordu.
   */
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto overscroll-contain bg-black/90 p-4 sm:p-6">
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center text-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent sm:h-14 sm:w-14">
          <AlertTriangle className="h-5 w-5 sm:h-7 sm:w-7" />
        </span>

        {diagnosis ? (
          <>
            <h3 className="mt-3 text-[15px] font-bold sm:mt-4 sm:text-[19px]">{diagnosis.title}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted sm:mt-2 sm:text-[14px]">
              {diagnosis.detail}
            </p>
          </>
        ) : (
          <>
            <h3 className="mt-3 text-[15px] font-bold sm:mt-4 sm:text-[19px]">Yayın açılamadı</h3>
            <p className="mt-2 flex items-center justify-center gap-2 text-[13px] text-fg-muted sm:text-[14px]">
              <Loader2 className="h-4 w-4 animate-spin" /> Sebep araştırılıyor…
            </p>
          </>
        )}

        {mixedContent && (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-fg-muted sm:px-4 sm:py-3 sm:text-[12.5px]">
            Bu sayfa https, yayın adresi ise http. Tarayıcı böyle bir yayını doğrudan açamaz; bu yüzden
            yayın sunucu üzerinden (proxy) aktarılmak zorunda.
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2 pb-1 sm:mt-5 sm:gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-accent px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-600 sm:px-4 sm:py-2.5 sm:text-[14px]"
          >
            Baştan dene
          </button>

          {diagnosis?.suggestProxy && (
            <button
              type="button"
              onClick={onRetryWithProxy}
              className="rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white/10 sm:px-4 sm:py-2.5 sm:text-[14px]"
            >
              Proxy ile dene
            </button>
          )}

          {diagnosis?.suggestExternal && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(src).then(() => setCopied(true));
              }}
              className="rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white/10 sm:px-4 sm:py-2.5 sm:text-[14px]"
            >
              {copied ? "Kopyalandı ✓" : "Bağlantıyı kopyala (VLC için)"}
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white/10 sm:px-4 sm:py-2.5 sm:text-[14px]"
            >
              Geri dön
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-full text-white transition-colors hover:bg-white/12"
    >
      {children}
    </button>
  );
}

function MenuButton({
  open,
  onToggle,
  label,
  icon,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <ControlButton onClick={onToggle} label={label}>
        {icon}
      </ControlButton>
      {open && (
        <div className="absolute bottom-12 right-0 max-h-[280px] w-48 overflow-y-auto rounded-xl border border-white/10 bg-ink-850/95 backdrop-blur-xl">
          <p className="border-b border-white/8 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-fg-dim">
            {label}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

function MenuOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-[13.5px] transition-colors hover:bg-white/8 ${
        active ? "font-semibold text-accent" : "text-fg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
