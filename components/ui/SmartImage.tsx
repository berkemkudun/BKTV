"use client";

import { useState } from "react";

import { hash } from "@/lib/utils/id";

const GRADIENTS = [
  ["#6d28d9", "#1e1b4b"],
  ["#be123c", "#3b0764"],
  ["#0e7490", "#0f172a"],
  ["#b45309", "#3f1d0b"],
  ["#1d4ed8", "#0b1220"],
  ["#a21caf", "#2e1065"],
  ["#047857", "#052e22"],
  ["#b91c1c", "#2c0b0b"],
];

/** Başlıktan deterministik renk çifti — aynı içerik her zaman aynı görünür. */
export function fallbackColors(seed: string): [string, string] {
  const index = Number.parseInt(hash(seed), 36) % GRADIENTS.length;
  return GRADIENTS[index] as [string, string];
}

export function fallbackGradient(seed: string): string {
  const [from, to] = fallbackColors(seed);
  return `radial-gradient(120% 90% at 20% 0%, ${from} 0%, ${to} 62%, #08080e 100%)`;
}

/** Kapak üzerindeki büyük monogram: "The Dark Knight" → "TD" */
function monogram(value: string): string {
  const words = value
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  return (words[0][0] + words[1][0]).toLocaleUpperCase("tr-TR");
}

interface SmartImageProps {
  src?: string;
  alt: string;
  /** Görsel yoksa/yüklenemezse gösterilecek yazı */
  fallbackText: string;
  /**
   * Boyut sınıfları. Bileşenin kökü `relative` olduğu için buraya `absolute`
   * vermeyin — konumlandırma gerekiyorsa bir sarmalayıcı div kullanın.
   */
  className?: string;
  /** Poster yerine logo gösterirken contain daha doğru */
  fit?: "cover" | "contain";
  priority?: boolean;
}

/**
 * Poster/logo gösterimi.
 *
 * M3U logoları ve TMDB posterleri rastgele host'lardan gelir; 404 ve karışık
 * boyutlar normaldir. Bu bileşen hepsini tek bir görünümde toplar:
 * yükleniyor → iskelet, hata/eksik → başlığa göre üretilmiş gradient kapak.
 */
export function SmartImage({
  src,
  alt,
  fallbackText,
  className = "",
  fit = "cover",
  priority = false,
}: SmartImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");

  // Kaynak değiştiğinde durumu render sırasında sıfırla (effect + setState yerine
  // React'in önerdiği "adjust state during render" kalıbı).
  const [trackedSrc, setTrackedSrc] = useState(src);
  if (trackedSrc !== src) {
    setTrackedSrc(src);
    setStatus(src ? "loading" : "error");
  }

  return (
    <div
      className={`relative overflow-hidden bg-ink-800 ${className}`}
      style={status === "error" ? { background: fallbackGradient(fallbackText) } : undefined}
    >
      {src && status !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element -- kaynaklar rastgele host'lardan geliyor
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={`h-full w-full transition-opacity duration-500 ${
            fit === "cover" ? "object-cover" : "object-contain p-3"
          } ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      )}

      {status === "loading" && <div className="skeleton absolute inset-0" />}

      {/*
        Poster/logo yoksa: başlıktan üretilmiş monogramlı kapak.
        Başlık metni burada tekrar edilmez — her kullanım yerinde zaten yanında/altında yazıyor.
      */}
      {status === "error" && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 grid select-none place-items-center">
            <span className="text-[clamp(28px,34%,110px)] font-black leading-none tracking-tighter text-white/22">
              {monogram(fallbackText)}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="absolute left-3 top-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">
            Stream Hub
          </span>
        </div>
      )}
    </div>
  );
}
