/**
 * Uygulamanın tüm veri modeli tek yerde.
 * Not: Bu tipler storage katmanından bağımsızdır; bugün IndexedDB/localStorage,
 * yarın Supabase tablolarına birebir map edilebilir (bkz. lib/storage/repository.ts).
 */

export type ContentType = "movie" | "series" | "live" | "sports" | "news" | "kids" | "other";

export interface Provider {
  id: string;
  /** Görünen ad: "Netflix" */
  name: string;
  /** URL slug: "netflix" */
  slug: string;
  /** Marka rengi (gradient/kart arka planı için) */
  color: string;
  /** M3U group-title içinde aranacak takma adlar (normalize edilmiş, küçük harf) */
  aliases: string[];
  /** M3U'dan gelen logo (varsa) */
  logo?: string;
}

/** M3U parser'ın ürettiği ham kayıt — hiçbir yorumlama yapılmadan. */
export interface RawEntry {
  /** #EXTINF attribute'ları */
  attributes: Record<string, string>;
  /** #EXTINF virgülden sonraki başlık */
  name: string;
  /** Süre (-1 ise canlı) */
  duration: number;
  url: string;
  /** #EXTGRP ya da group-title */
  group: string;
}

export interface SeriesRef {
  /** Dizi kimliği (playlist içinde stabil) */
  seriesId: string;
  season: number;
  episode: number;
  /** "S01E04" gibi ham etiket */
  label: string;
}

export interface ContentItem {
  /** Playlist'ler arası stabil, içerik bazlı id */
  id: string;
  title: string;
  /** Yıl, başlık ya da attribute'lardan çıkarıldıysa */
  year?: number;
  type: ContentType;
  /** Provider slug ("netflix"), yoksa "other" */
  providerSlug: string;
  /** M3U group-title (ham) */
  group: string;
  /** Ham grup adından üretilen alt kategori: "Action", "Comedy"... */
  category?: string;
  streamUrl: string;
  /** tvg-logo */
  logo?: string;
  /** tvg-id — EPG eşleştirmesi için saklanır */
  tvgId?: string;
  /** Ülke kodu (canlı TV grupları için tahmin edilir) */
  country?: string;
  /** Bu içeriğin geldiği playlist */
  playlistId: string;
  /** Dizi bölümü ise sezon/bölüm bilgisi */
  episodeOf?: SeriesRef;
  /** Aynı içerik birden fazla kaynakta varsa alternatif stream'ler */
  sources?: StreamSource[];
}

export interface StreamSource {
  label: string;
  url: string;
  playlistId: string;
}

/** Bölümleri gruplanmış dizi görünümü (library derlenirken üretilir). */
export interface SeriesItem {
  id: string;
  title: string;
  year?: number;
  providerSlug: string;
  group: string;
  logo?: string;
  playlistId: string;
  seasons: Season[];
  episodeCount: number;
}

export interface Season {
  season: number;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  seriesId: string;
  season: number;
  episode: number;
  title: string;
  streamUrl: string;
  logo?: string;
}

/** Xtream paneline giriş yapıldıysa hesabın son bilinen durumu. */
export interface XtreamAccount {
  host: string;
  username: string;
  status: string;
  isTrial: boolean;
  /** Abonelik bitişi (ms). Panel vermezse null. */
  expiresAt: number | null;
  /** Aynı anda kaç yayın açılabilir — 503'lerin en yaygın sebebi */
  maxConnections: number | null;
  activeConnections: number | null;
  /** Listenin hangi formatta istendiği: "m3u8" tarayıcıda çok daha kararlı */
  outputFormat: string;
}

export interface Playlist {
  id: string;
  name: string;
  /** URL ile eklendiyse kaynak adres; dosya ile eklendiyse undefined */
  url?: string;
  source: "url" | "file" | "demo" | "xtream";
  /** source === "xtream" ise panel hesabının bilgileri */
  xtream?: XtreamAccount;
  lastUpdated: number;
  itemCount: number;
  /**
   * Bu liste hangi sınıflandırma sürümüyle ayrıştırıldı.
   * Parser/sınıflandırma geliştiğinde eski listeler "yenile" uyarısı alır
   * (ham M3U metni saklanmadığı için yeniden indirmek gerekir).
   */
  parserVersion?: number;
  /** Son yenilemede hata alındıysa */
  error?: string;
}

export interface WatchProgress {
  contentId: string;
  title: string;
  /** Dizi bölümüyse "S02E04" */
  episodeLabel?: string;
  seriesId?: string;
  type: ContentType;
  positionSec: number;
  durationSec: number;
  percent: number;
  updatedAt: number;
  poster?: string;
  logo?: string;
  streamUrl: string;
}

export interface FavoriteEntry {
  id: string;
  title: string;
  type: ContentType;
  addedAt: number;
  poster?: string;
  logo?: string;
}

export interface PlayerSettings {
  autoplay: boolean;
  rememberPosition: boolean;
  /** "auto" | "1080" | "720" | "480" — HLS level seçimi */
  defaultQuality: "auto" | "1080" | "720" | "480";
  /** Stream'i /api/proxy üzerinden geçir (CORS engelli kaynaklar için) */
  useStreamProxy: boolean;
}

export interface UserPreferences {
  favorites: Record<string, FavoriteEntry>;
  watchHistory: Record<string, WatchProgress>;
  /** Ana ekranda gösterilecek provider slug'ları; boşsa hepsi */
  selectedProviders: string[];
  player: PlayerSettings;
  tmdbEnabled: boolean;
}

/** Parse + sınıflandırma sonucu; store'da tutulan türetilmiş kütüphane. */
export interface Library {
  items: ContentItem[];
  series: SeriesItem[];
  providers: LibraryProvider[];
  counts: Record<ContentType, number>;
}

export interface LibraryProvider extends Provider {
  itemCount: number;
  movieCount: number;
  seriesCount: number;
  liveCount: number;
}

/** TMDB'den dönen normalize metadata. */
export interface TmdbMeta {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  rating?: number;
  genres: string[];
  runtime?: number;
  cast: { name: string; character?: string; photo?: string }[];
  director?: string;
  /** Benzer içerikler (TMDB önerileri) */
  similar: { tmdbId: number; title: string; poster?: string; year?: number }[];
}
