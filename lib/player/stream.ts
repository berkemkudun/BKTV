/**
 * Stream adresinin hangi motorla oynatılacağını belirler.
 *
 * IPTV panellerinde (Xtream Codes ve türevleri) üç tip adres vardır:
 *   .../live/USER/PASS/1234.ts     → ham MPEG-TS  (tarayıcı DESTEKLEMEZ, mpegts.js gerekir)
 *   .../live/USER/PASS/1234.m3u8   → HLS          (hls.js)
 *   .../movie|series/USER/PASS/1234.mkv|mp4 → dosya (native <video>)
 *
 * Çoğu panel aynı kanalı hem .ts hem .m3u8 olarak sunar; .ts adresi verilmişse
 * önce .m3u8 varyantı denenir çünkü HLS tarayıcıda çok daha kararlı çalışır.
 */

export type StreamKind = "hls" | "mpegts" | "progressive";

const HLS_EXT = /\.m3u8(\?|$)/i;
const TS_EXT = /\.(ts|mpegts|mpeg|mts)(\?|$)/i;
const FILE_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)(\?|$)/i;

export function detectStreamKind(url: string): StreamKind {
  const path = pathOf(url);
  if (HLS_EXT.test(path)) return "hls";
  if (TS_EXT.test(path)) return "mpegts";
  if (FILE_EXT.test(path)) return "progressive";

  // Uzantısız Xtream canlı adresi: .../live/user/pass/1234  ya da  .../user/pass/1234
  if (/\/live\//i.test(path) || /\/\d+$/.test(path)) return "mpegts";

  return "progressive";
}

/**
 * Tarayıcının hiçbir şekilde açamayacağı konteynerler.
 *
 * Not: .mkv bilinçli olarak bu listede DEĞİL — Chrome, içinde H.264/AAC olan
 * Matroska dosyalarını oynatabiliyor (test edildi). MKV'de sorun konteyner değil,
 * içindeki kodek olur; o da probe + MediaError ile ayırt ediliyor.
 */
export function isUnsupportedContainer(url: string): boolean {
  return /\.(avi|flv|wmv|rmvb|mpg|mpeg|divx)(\?|$)/i.test(pathOf(url));
}

/** Kodek riski yüksek konteynerler: açılabilir ama garanti değil. */
export function isRiskyContainer(url: string): boolean {
  return /\.(mkv|m2ts|ts)(\?|$)/i.test(pathOf(url));
}

export function containerLabel(url: string): string {
  const match = pathOf(url).match(/\.([a-z0-9]+)(\?|$)/i);
  return match ? match[1].toUpperCase() : "bilinmeyen";
}

/**
 * Denenecek kaynak sırası.
 *
 * Sıra bilinçli: önce doğrudan (kullanıcının kendi IP'si üzerinden, en hızlısı),
 * .ts ise önce onun HLS varyantı, en sonda proxy'li denemeler.
 * Her adım bir öncekinin hatası üzerine otomatik denenir.
 */
export function buildSourceCandidates(url: string, forceProxy = false): StreamCandidate[] {
  const candidates: StreamCandidate[] = [];
  const kind = detectStreamKind(url);

  const push = (candidateUrl: string, candidateKind: StreamKind, viaProxy: boolean, label: string) => {
    const finalUrl = viaProxy ? `/api/proxy?url=${encodeURIComponent(candidateUrl)}` : candidateUrl;
    if (candidates.some((candidate) => candidate.url === finalUrl)) return;
    candidates.push({ url: finalUrl, kind: candidateKind, viaProxy, label, originalUrl: candidateUrl });
  };

  const hlsVariant = toHlsVariant(url);

  if (forceProxy) {
    if (hlsVariant) push(hlsVariant, "hls", true, "HLS + proxy");
    push(url, kind, true, "proxy");
    if (hlsVariant) push(hlsVariant, "hls", false, "HLS");
    push(url, kind, false, "doğrudan");
    return candidates;
  }

  if (hlsVariant) push(hlsVariant, "hls", false, "HLS");
  push(url, kind, false, "doğrudan");
  if (hlsVariant) push(hlsVariant, "hls", true, "HLS + proxy");
  push(url, kind, true, "proxy");

  return candidates;
}

export interface StreamCandidate {
  /** Oynatıcıya verilecek nihai adres (proxy'liyse /api/proxy?url=...) */
  url: string;
  kind: StreamKind;
  viaProxy: boolean;
  /** Hata mesajlarında gösterilecek kısa etiket */
  label: string;
  /** Proxy'siz orijinal adres */
  originalUrl: string;
}

/** `.../1234.ts` → `.../1234.m3u8` (Xtream panellerinin çoğu ikisini de sunar). */
export function toHlsVariant(url: string): string | null {
  const path = pathOf(url);
  if (HLS_EXT.test(path)) return null;

  // $2 = query başlangıcı ("?" ya da boş); $1 uzantının kendisidir, korunmamalı.
  if (TS_EXT.test(path)) return url.replace(TS_EXT, ".m3u8$2");

  // Uzantısız canlı adres
  if (/\/live\//i.test(path) && /\/\d+$/.test(path)) return `${url}.m3u8`;
  if (/^\/[^/]+\/[^/]+\/\d+$/.test(path)) return `${url}.m3u8`;

  return null;
}

function pathOf(url: string): string {
  try {
    return new URL(url, "http://x").pathname;
  } catch {
    return url.split("?")[0];
  }
}
