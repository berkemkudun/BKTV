"use client";

import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import type Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

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
  /** Kaynağı /api/proxy üzerinden geçir */
  useProxy?: boolean;
  onBack?: () => void;
  /** Saniyede bir değil, ~5 saniyede bir çağrılır */
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
}

type PlayerError = { message: string; canRetryWithProxy: boolean };

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
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReport = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState<PlayerError | null>(null);
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  /** hls.autoLevelEnabled render sırasında okunamaz (ref) — state olarak yansıtılır. */
  const [autoLevel, setAutoLevel] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proxied, setProxied] = useState(useProxy);

  const effectiveSrc = proxied ? `/api/proxy?url=${encodeURIComponent(src)}` : src;

  // ---- Kaynağı bağla (HLS ya da native) --------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let disposed = false;
    setError(null);
    setBuffering(true);
    setLevels([]);

    const isHls = /\.m3u8(\?|$)/i.test(effectiveSrc) || /\/api\/proxy\?/.test(effectiveSrc);
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    const attachNative = () => {
      video.src = effectiveSrc;
      if (startPosition > 0 && !isLive) video.currentTime = startPosition;
      if (autoPlay) void video.play().catch(() => setPlaying(false));
    };

    if (isHls && !nativeHls) {
      void (async () => {
        const HlsModule = (await import("hls.js")).default;
        if (disposed) return;

        if (!HlsModule.isSupported()) {
          setError({ message: "Tarayıcın HLS yayınlarını desteklemiyor.", canRetryWithProxy: false });
          setBuffering(false);
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
              .map((level, index) => ({ index, height: level.height ?? 0 }))
              .filter((level) => level.height > 0)
              .sort((a, b) => b.height - a.height),
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
          if (autoPlay) void video.play().catch(() => setPlaying(false));
        });

        hls.on(HlsModule.Events.LEVEL_SWITCHED, (_event, data) => setCurrentLevel(data.level));

        hls.on(HlsModule.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          switch (data.type) {
            case HlsModule.ErrorTypes.NETWORK_ERROR:
              // Manifest hiç yüklenemediyse büyük ihtimalle CORS → proxy önerilir.
              setError({
                message: proxied
                  ? "Yayına ulaşılamıyor. Kaynak kapalı olabilir veya adres geçersiz."
                  : "Yayın yüklenemedi. Kaynak tarayıcı isteklerini engelliyor olabilir.",
                canRetryWithProxy: !proxied,
              });
              setBuffering(false);
              break;
            case HlsModule.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError({ message: "Yayın oynatılamadı.", canRetryWithProxy: !proxied });
              setBuffering(false);
          }
        });

        hls.loadSource(effectiveSrc);
        hls.attachMedia(video);
      })();
    } else {
      attachNative();
    }

    return () => {
      disposed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };
    // startPosition kasıtlı olarak dependency değil: her seek'te kaynağı yeniden bağlamamalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSrc, src, isLive, autoPlay, preferredQuality, proxied]);

  // ---- Video olayları ---------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setError(null);
    };
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
      setBuffering(false);
      setError({
        message: proxied
          ? "Video oynatılamadı. Kaynak yanıt vermiyor olabilir."
          : "Video oynatılamadı. Kaynak engellemiş olabilir.",
        canRetryWithProxy: !proxied,
      });
    };
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
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
  }, [isLive, onProgress, onEnded, proxied]);

  // Sayfadan ayrılırken son konumu bildir.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video || isLive || !onProgress) return;
      if (video.duration > 0 && video.currentTime > 5) onProgress(video.currentTime, video.duration);
    };
  }, [isLive, onProgress]);

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

  // Açılışta kontroller görünür (initial state), 3.2sn sonra gizlenir.
  useEffect(() => {
    const timer = setTimeout(() => setControlsVisible(false), 3200);
    hideControlsTimer.current = timer;
    return () => clearTimeout(timer);
  }, []);

  // ---- Klavye / kumanda kısayolları ------------------------------------
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
        HLS zaten hls.js üzerinden XHR ile çekildiği için ayrıca CORS gerektirir.
      */}
      <video ref={videoRef} onClick={togglePlay} playsInline className="h-full w-full bg-black" />

      {buffering && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-12 w-12 animate-spin text-white/80" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 p-6">
          <div className="max-w-md text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent">
              <AlertTriangle className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-[19px] font-bold">Yayın açılamadı</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{error.message}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {error.canRetryWithProxy && (
                <button
                  type="button"
                  onClick={() => {
                    setProxied(true);
                    setError(null);
                  }}
                  className="rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-600"
                >
                  Proxy ile tekrar dene
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  const video = videoRef.current;
                  video?.load();
                  void video?.play().catch(() => {});
                }}
                className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-[14px] font-semibold transition-colors hover:bg-white/10"
              >
                Yeniden dene
              </button>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-[14px] font-semibold transition-colors hover:bg-white/10"
                >
                  Geri dön
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Üst bar */}
      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-start gap-4 bg-gradient-to-b from-black/85 to-transparent p-5 transition-opacity duration-300 ${
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
          <h1 className="truncate text-[18px] font-bold">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-fg-muted">{subtitle}</p>}
        </div>
        {isLive && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Canlı
          </span>
        )}
      </div>

      {/* Alt kontroller */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pb-5 pt-16 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
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

          <div className="group/volume flex items-center gap-2">
            <ControlButton
              onClick={() => {
                const video = videoRef.current;
                if (video) video.muted = !video.muted;
              }}
              label={muted ? "Sesi aç" : "Sessize al"}
            >
              {muted || volume === 0 ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
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
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 opacity-0 transition-all duration-300 group-hover/volume:w-20 group-hover/volume:opacity-100 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {levels.length > 1 && (
              <div className="relative">
                <ControlButton onClick={() => setSettingsOpen((open) => !open)} label="Kalite">
                  <Settings2 className="h-[18px] w-[18px]" />
                </ControlButton>
                {settingsOpen && (
                  <div className="absolute bottom-12 right-0 w-36 overflow-hidden rounded-xl border border-white/10 bg-ink-850/95 backdrop-blur-xl">
                    <QualityOption
                      label="Otomatik"
                      active={autoLevel}
                      onClick={() => {
                        if (hlsRef.current) hlsRef.current.currentLevel = -1;
                        setAutoLevel(true);
                        setSettingsOpen(false);
                      }}
                    />
                    {levels.map((level) => (
                      <QualityOption
                        key={level.index}
                        label={`${level.height}p`}
                        active={!autoLevel && currentLevel === level.index}
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.currentLevel = level.index;
                          setAutoLevel(false);
                          setSettingsOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
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

function QualityOption({
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
