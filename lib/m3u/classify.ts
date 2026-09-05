import { normalizeForMatch } from "@/lib/config/providers";
import type { ContentType, SeriesRef } from "@/lib/types";

/**
 * İçerik tipi tespiti.
 * Sıralama önemli: dizi kalıbı (S01E01) grup adından daha güçlü bir sinyaldir.
 */
/**
 * Sonuna `*` konan kelimeler Türkçe eklerle birlikte eşleşir:
 * "film*" → film, filmler, filmleri, filmi …
 * Bu şart, "Türk Çocuk Filmleri" gibi VOD gruplarının kanal sanılmasını engeller —
 * sıra da bu yüzden önemli: film/dizi sinyali, çocuk/spor/haber'den önce gelir.
 */
const TYPE_KEYWORDS: { type: ContentType; keywords: string[] }[] = [
  { type: "series", keywords: ["series", "serie", "dizi*", "tv shows", "shows", "sezon*", "season"] },
  { type: "movie", keywords: ["movie*", "film*", "vod", "sinema*", "cinema"] },
  { type: "kids", keywords: ["kids", "cocuk*", "cizgi*", "cartoon*", "anime", "animation", "animasyon", "child"] },
  {
    type: "sports",
    keywords: ["sport*", "spor*", "futbol*", "football", "bein", "dazn", "espn", "s sport", "nba", "ufc"],
  },
  { type: "news", keywords: ["news", "haber*"] },
  { type: "live", keywords: ["live", "canli*", "channels", "kanal*", "tv", "iptv", "ulusal", "yerel"] },
];

/** Yalnızca VOD sunan platformlar — bu gruplarda "canlı" varsayımı yanlış olur. */
const VOD_PROVIDER_SLUGS = new Set([
  "netflix",
  "prime-video",
  "disney-plus",
  "max",
  "apple-tv-plus",
  "blutv",
  "exxen",
  "gain",
  "tabii",
  "hulu",
  "paramount-plus",
  "peacock",
]);

/** "Inception (2010)" gibi başlıklarda ayrı bir token olarak yıl arar. */
const YEAR_TOKEN = /(^|[\s([\-|])((?:19|20)\d{2})([\s)\]\-|]|$)/;

/**
 * @param group        group-title (ham)
 * @param name         kanal/içerik adı
 * @param url          stream adresi (uzantı ipucu verir: .mp4/.mkv = VOD, .m3u8/.ts = canlı)
 * @param duration     EXTINF süresi (-1 → canlı yayın olma ihtimali yüksek)
 * @param providerSlug tespit edilmiş platform (varsa) — VOD platformları canlı sayılmaz
 */
export function detectContentType(
  group: string,
  name: string,
  url: string,
  duration: number,
  providerSlug?: string,
): ContentType {
  // 1) Xtream Codes adres şeması en kesin sinyaldir; grup adına hiç bakmaya gerek yok:
  //    .../live/USER/PASS/1.ts  ·  .../movie/USER/PASS/1.mkv  ·  .../series/USER/PASS/1.mkv
  const xtream = detectXtreamKind(url);
  if (xtream === "movie") return "movie";
  if (xtream === "series") return "series";
  if (xtream === "live") {
    // Canlı olduğu kesin; grup adı spor/haber/çocuk diyorsa o alt tipi koru.
    const groupHint = matchTypeKeywords(group);
    return groupHint === "sports" || groupHint === "news" || groupHint === "kids" ? groupHint : "live";
  }

  // Grup adı en güvenilir sinyal. Canlı/spor/haber gruplarında kanal isimleri
  // yanlışlıkla bölüm kalıbına benzeyebilir ("News 24x7"), bu yüzden önce grup bakılır.
  const groupType = matchTypeKeywords(group);
  if (groupType === "live" || groupType === "sports" || groupType === "news") return groupType;

  if (parseSeriesInfo(name) || parseSeriesInfo(group)) return "series";
  if (groupType) return groupType;

  const nameType = matchTypeKeywords(name);
  if (nameType) return nameType;

  // Grup adı tip belirtmiyor: başlıktaki yıl güçlü bir VOD sinyalidir.
  if (YEAR_TOKEN.test(name)) return "movie";

  // Netflix/Prime gibi platformlar canlı yayın vermez.
  if (providerSlug && VOD_PROVIDER_SLUGS.has(providerSlug)) return "movie";

  // Son çare: URL uzantısı.
  const path = url.split("?")[0].toLowerCase();
  if (/\.(mp4|mkv|avi|mov|m4v)$/.test(path)) return "movie";
  if (/\.(m3u8|ts)$/.test(path) && duration === -1) return "live";
  if (duration > 0) return "movie";

  return "other";
}

/**
 * Xtream Codes ve türevi panellerin adres şeması:
 *   http://host:8080/live/USER/PASS/12345.ts
 *   http://host:8080/movie/USER/PASS/12345.mkv
 *   http://host:8080/series/USER/PASS/12345.mp4
 * Bu segment, grup adından çok daha güvenilir bir tip bilgisidir.
 */
export function detectXtreamKind(url: string): "live" | "movie" | "series" | null {
  if (!url) return null;
  let path: string;
  try {
    path = new URL(url, "http://x").pathname.toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  if (/(^|\/)series\//.test(path)) return "series";
  if (/(^|\/)(movie|movies|vod)\//.test(path)) return "movie";
  if (/(^|\/)live\//.test(path)) return "live";
  return null;
}

function matchTypeKeywords(value: string): ContentType | null {
  if (!value) return null;
  const haystack = normalizeForMatch(value);
  for (const { type, keywords } of TYPE_KEYWORDS) {
    for (const keyword of keywords) {
      if (keywordRegExp(keyword).test(haystack)) return type;
    }
  }
  return null;
}

const KEYWORD_CACHE = new Map<string, RegExp>();

/** `film*` → /(^| )film[a-z0-9]*( |$)/ · `news` → /(^| )news( |$)/ */
function keywordRegExp(keyword: string): RegExp {
  const cached = KEYWORD_CACHE.get(keyword);
  if (cached) return cached;

  const stem = keyword.endsWith("*");
  const base = escapeRegExp(stem ? keyword.slice(0, -1) : keyword);
  const pattern = new RegExp(`(^| )${base}${stem ? "[a-z0-9]*" : ""}( |$)`);
  KEYWORD_CACHE.set(keyword, pattern);
  return pattern;
}

const SERIES_PATTERNS: RegExp[] = [
  // S01E02 / S01 E02 / S01.E02 / s1e2
  /\bs\s?(\d{1,2})\s?[.\-_ ]?\s?e\s?(\d{1,3})\b/i,
  // Season 1 Episode 2 / Sezon 1 Bölüm 2
  /\b(?:season|sezon)\s*(\d{1,2})\s*(?:episode|epizod|bolum|bölüm|ep)\s*(\d{1,3})\b/i,
  // 1x02 — bölüm numarası en az iki haneli olmalı; aksi halde "24x7", "2x2" gibi
  // kanal isimleri dizi sanılıyor.
  /\b(\d{1,2})\s?x\s?(\d{2,3})\b/i,
  // "... 1. Sezon 2. Bölüm"
  /\b(\d{1,2})\s*\.?\s*(?:sezon)\s*(\d{1,3})\s*\.?\s*(?:bolum|bölüm)\b/i,
];

/** "Breaking Bad S02 E04" → { season: 2, episode: 4, label: "S02E04" } */
export function parseSeriesInfo(value: string): Omit<SeriesRef, "seriesId"> | null {
  if (!value) return null;
  for (const pattern of SERIES_PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    const season = Number(match[1]);
    const episode = Number(match[2]);
    if (!Number.isFinite(season) || !Number.isFinite(episode)) continue;
    if (season > 50 || episode > 999) continue; // "4K 2160" gibi yanlış eşleşmeleri ele
    return {
      season,
      episode,
      label: `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`,
    };
  }
  return null;
}

/** Başlık başında görülen ülke/dil/kalite kodları. */
const PREFIX_CODES = new Set([
  "tr", "en", "us", "uk", "de", "fr", "nl", "ar", "es", "it", "az", "ru", "pl", "pt",
  "tur", "eng", "ger", "fra", "vip", "4k", "hd", "fhd", "uhd", "sd", "vod",
]);

/**
 * M3U başlıklarını TMDB'de aranabilir hale getirir.
 * "TR | Inception (2010) [4K]" → { title: "Inception", year: 2010 }
 */
export function cleanTitle(rawTitle: string): { title: string; year?: number } {
  let title = rawTitle.trim();

  // Baştaki ülke/kalite öneklerini at ("TR |", "EN -", "4K:").
  // Sadece bilinen kodlar temizlenir — aksi halde "Dune: Part Two" gibi başlıklar bozulur.
  // Ayraçtan sonra boşluk şart değil: "TR:GREY'S ANATOMY" da temizlenmeli.
  const prefixMatch = title.match(/^\s*([A-Za-z0-9+]{2,4})\s*[|:\-–]\s*/);
  if (prefixMatch && PREFIX_CODES.has(prefixMatch[1].toLowerCase())) {
    title = title.slice(prefixMatch[0].length);
  }

  // Yıl yakala (4 haneli, 1900-2099)
  let year: number | undefined;
  const yearMatch = title.match(/[([]?\b(19\d{2}|20\d{2})\b[)\]]?/);
  if (yearMatch) {
    year = Number(yearMatch[1]);
    title = title.replace(yearMatch[0], " ");
  }

  // Sezon/bölüm etiketini at
  for (const pattern of SERIES_PATTERNS) {
    title = title.replace(pattern, " ");
  }

  // Kalite / dil / codec etiketleri
  title = title.replace(
    /\b(4k|uhd|fhd|hd|sd|1080p?|720p?|480p|2160p?|hdr|dolby|dv|x264|x265|hevc|web[- ]?dl|bluray|dublaj|altyazi|altyazılı|turkce|türkçe|tr\s?dub|multi|vip|opt(?:ion)?\s?\d+)\b/gi,
    " ",
  );

  // Kalan ayraçlar ve boş parantezler
  title = title
    .replace(/[\[\]{}]/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/[|•·]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–]\s*$/, "")
    .replace(/^\s*[-–]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title: title || rawTitle.trim(), year };
}

/**
 * "Netflix | Movies - Action" gibi grup adından alt kategoriyi çıkarır.
 * Provider adı ve tip kelimeleri temizlenince geriye kalan parçadır.
 */
export function extractCategory(group: string, providerName: string): string | undefined {
  if (!group) return undefined;
  const parts = group
    .split(/[|/>–-]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const noise = new Set(
    [
      providerName,
      "movies",
      "movie",
      "film",
      "filmler",
      "vod",
      "series",
      "dizi",
      "diziler",
      "tv shows",
      "shows",
      "live",
      "canli",
      "canlı",
      "tv",
      "4k",
      "uhd",
      "fhd",
      "hd",
    ].map((value) => normalizeForMatch(value)),
  );

  const remaining = parts.filter((part) => !noise.has(normalizeForMatch(part)));
  const candidate = remaining[remaining.length - 1];
  if (!candidate) return undefined;
  return candidate.length > 40 ? candidate.slice(0, 40) : candidate;
}

const COUNTRY_HINTS: { code: string; label: string; keywords: string[] }[] = [
  { code: "TR", label: "Türkiye", keywords: ["turkiye", "turkey", "tr", "turk", "ulusal", "yerel"] },
  { code: "US", label: "ABD", keywords: ["usa", "us", "united states", "america"] },
  { code: "UK", label: "İngiltere", keywords: ["uk", "united kingdom", "england", "britain", "gb"] },
  { code: "DE", label: "Almanya", keywords: ["de", "germany", "deutschland", "almanya"] },
  { code: "FR", label: "Fransa", keywords: ["fr", "france", "fransa"] },
  { code: "NL", label: "Hollanda", keywords: ["nl", "netherlands", "holland"] },
  { code: "AZ", label: "Azerbaycan", keywords: ["az", "azerbaijan", "azerbaycan"] },
  { code: "AR", label: "Arapça", keywords: ["ar", "arabic", "arab"] },
  { code: "ES", label: "İspanya", keywords: ["es", "spain", "espana"] },
  { code: "IT", label: "İtalya", keywords: ["it", "italy", "italia"] },
];

/**
 * Kanalın ülkesi.
 *
 * Sıra güvenilirlikten tahmine doğru:
 *  1. `tvg-country` attribute'u (varsa kesin bilgi)
 *  2. `tvg-id` soneki — "TRT1.tr", "4UTV.tr@SD" biçimi iptv-org'da ve birçok
 *     panelde standarttır; grup adı "General" olsa bile ülkeyi verir
 *  3. `tvg-language` ("Turkish")
 *  4. Grup/kanal adındaki metin ipuçları ("TR | ULUSAL", "TÜRKİYE")
 */
export function detectCountry(
  group: string,
  name: string,
  attributes?: Record<string, string>,
): string | undefined {
  const explicit = normalizeCode(attributes?.["tvg-country"]);
  if (explicit) return explicit;

  const tvgId = attributes?.["tvg-id"];
  const idMatch = tvgId?.match(/\.([a-z]{2})(?:@|$)/i);
  const fromId = normalizeCode(idMatch?.[1]);
  if (fromId) return fromId;

  const language = normalizeForMatch(attributes?.["tvg-language"] ?? "");
  if (language.includes("turkish") || language.includes("turkce")) return "TR";

  const haystack = normalizeForMatch(`${group} ${name}`);
  for (const { code, keywords } of COUNTRY_HINTS) {
    for (const keyword of keywords) {
      if (new RegExp(`(^| )${escapeRegExp(keyword)}( |$)`).test(haystack)) return code;
    }
  }
  return undefined;
}

/** "tr" → "TR", "gb" → "UK" (listemizdeki kodla aynı olsun diye). */
function normalizeCode(value: string | undefined): string | undefined {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return undefined;
  return code === "GB" ? "UK" : code;
}

export function countryLabel(code: string): string {
  return COUNTRY_HINTS.find((entry) => entry.code === code)?.label ?? code;
}

export const COUNTRY_LIST = COUNTRY_HINTS.map(({ code, label }) => ({ code, label }));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
