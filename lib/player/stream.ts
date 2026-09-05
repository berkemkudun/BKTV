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
 * Tarayıcı ortamının oynatma yetenekleri.
 *
 * Node (test) tarafında `window` yoktur; o durumda "her şey mümkün" varsayılır
 * ve aday sırası eski davranışıyla aynı kalır.
 */
export interface PlaybackEnvironment {
  /** Sayfa https iken http yayın: tarayıcı doğrudan bağlantıyı engeller (mixed content) */
  insecurePage: boolean;
  /** MediaSource var mı? Yoksa (iOS Safari) mpegts.js ve hls.js çalışamaz */
  mseSupported: boolean;
  /** Safari/iOS: .m3u8 doğrudan <video src> ile açılabilir */
  nativeHls: boolean;
}

export function detectEnvironment(streamUrl?: string): PlaybackEnvironment {
  if (typeof window === "undefined") {
    return { insecurePage: false, mseSupported: true, nativeHls: false };
  }
  const video = document.createElement("video");
  return {
    insecurePage:
      window.location.protocol === "https:" && Boolean(streamUrl?.toLowerCase().startsWith("http://")),
    mseSupported:
      typeof window.MediaSource !== "undefined" &&
      typeof window.MediaSource.isTypeSupported === "function",
    nativeHls: video.canPlayType("application/vnd.apple.mpegurl") !== "",
  };
}

/**
 * Denenecek kaynak sırası.
 *
 * Sıra bilinçli:
 *  - Sayfa https, yayın http ise DOĞRUDAN bağlantı tarayıcı tarafından engellenir
 *    (mixed content). Bu durumda yalnızca proxy'li adaylar üretilir — aksi halde
 *    kullanıcı "hiçbir kanal açılmıyor" diyor ve zincir boşuna 4 adım ilerliyordu.
 *  - MSE yoksa (iOS Safari) mpegts.js ve hls.js kullanılamaz; sadece native HLS
 *    açılabilen .m3u8 adayları anlamlıdır.
 *  - Diğer hallerde: HLS varyantı → doğrudan → proxy'li HLS → proxy.
 */
export function buildSourceCandidates(
  url: string,
  forceProxy = false,
  env: PlaybackEnvironment = detectEnvironment(url),
): StreamCandidate[] {
  const candidates: StreamCandidate[] = [];
  const kind = detectStreamKind(url);

  const push = (candidateUrl: string, candidateKind: StreamKind, viaProxy: boolean, label: string) => {
    // Mixed content: https sayfada http adres tarayıcıda hiç istek bile atamaz.
    // (https'e yükseltilmiş adaylar bu kuraldan muaf — engellenen şey şema.)
    if (env.insecurePage && !viaProxy && candidateUrl.toLowerCase().startsWith("http://")) return;
    // MSE yoksa yalnızca native açılabilen kaynaklar denenebilir.
    if (!env.mseSupported) {
      if (candidateKind === "mpegts") return;
      if (candidateKind === "hls" && !env.nativeHls) return;
    }
    const finalUrl = viaProxy ? `/api/proxy?url=${encodeURIComponent(candidateUrl)}` : candidateUrl;
    if (candidates.some((candidate) => candidate.url === finalUrl)) return;
    candidates.push({ url: finalUrl, kind: candidateKind, viaProxy, label, originalUrl: candidateUrl });
  };

  const hlsVariant = toHlsVariant(url);

  if (forceProxy || env.insecurePage) {
    if (hlsVariant) push(hlsVariant, "hls", true, "HLS + proxy");
    push(url, kind, true, "proxy");

    /*
     * Son çare: adresi https'e yükselt.
     *
     * Sayfa https iken http yayın engelli, proxy de sağlayıcı veri merkezi
     * IP'lerini engelliyorsa çalışmıyor. Bazı paneller aynı adresi TLS ile de
     * veriyor; o durumda tarayıcı yayını doğrudan açabiliyor. Panel TLS
     * konuşmuyorsa bağlantı anında reddedilir, zincir hızlıca ilerler.
     */
    if (env.insecurePage) {
      const secure = url.replace(/^http:/i, "https:");
      const secureHls = hlsVariant?.replace(/^http:/i, "https:");
      if (secureHls) push(secureHls, "hls", false, "HLS (https)");
      push(secure, kind, false, "https");
    }

    if (hlsVariant) push(hlsVariant, "hls", false, "HLS");
    push(url, kind, false, "doğrudan");
  } else {
    if (hlsVariant) push(hlsVariant, "hls", false, "HLS");
    push(url, kind, false, "doğrudan");
    if (hlsVariant) push(hlsVariant, "hls", true, "HLS + proxy");
    push(url, kind, true, "proxy");
  }

  // Hiçbir aday üretilemediyse (ör. MSE yok + HLS varyantı yok) en azından
  // orijinal adresi dene; tarayıcı belki açar, açamazsa tanı ekranı devreye girer.
  if (candidates.length === 0) {
    const viaProxy = env.insecurePage;
    candidates.push({
      url: viaProxy ? `/api/proxy?url=${encodeURIComponent(url)}` : url,
      kind,
      viaProxy,
      label: viaProxy ? "proxy" : "doğrudan",
      originalUrl: url,
    });
  }

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
