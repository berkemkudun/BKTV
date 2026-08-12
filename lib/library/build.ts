import { OTHER_PROVIDER, PROVIDERS, detectProvider, normalizeForMatch } from "@/lib/config/providers";
import {
  cleanTitle,
  detectContentType,
  detectCountry,
  extractCategory,
  parseSeriesInfo,
} from "@/lib/m3u/classify";
import type {
  ContentItem,
  ContentType,
  Library,
  LibraryProvider,
  RawEntry,
  Season,
  SeriesItem,
} from "@/lib/types";
import { hash } from "@/lib/utils/id";

/**
 * Sınıflandırma sürümü.
 *
 * Provider/tip/dizi tespiti değiştiğinde artırın: kayıtlı playlistler "yenile"
 * uyarısı gösterir, çünkü kütüphane parse anındaki kurallarla derlenmiştir.
 */
export const PARSER_VERSION = 2;

/**
 * Ham M3U kayıtlarını uygulamanın kullandığı kütüphaneye dönüştürür.
 *
 * Adımlar:
 *  1. Başlık temizleme + yıl çıkarma
 *  2. Provider normalizasyonu (providers.ts konfigürasyonu)
 *  3. İçerik tipi tespiti (film / dizi / canlı / spor / haber / çocuk)
 *  4. Dizi bölümlerinin S/E bilgisiyle gruplanması
 *  5. Aynı içeriğin farklı playlist/kalitelerdeki kopyalarının tek kayda indirgenmesi
 */
export function buildLibraryFromEntries(entries: RawEntry[], playlistId: string): {
  items: ContentItem[];
  series: SeriesItem[];
} {
  const itemsById = new Map<string, ContentItem>();
  const seriesBuckets = new Map<string, { title: string; providerSlug: string; group: string; logo?: string; year?: number; episodes: ContentItem[] }>();
  /** S/E bilgisi olmayan dizi bölümleri için sıra sayacı (bkz. aşağıda) */
  const sequentialEpisodes = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.url) continue;

    const rawName = entry.attributes["tvg-name"]?.trim() || entry.name?.trim() || "";
    if (!rawName) continue;

    const group = entry.group || entry.attributes["group-title"] || "";
    const provider = detectProvider(group, rawName);
    const type = detectContentType(group, rawName, entry.url, entry.duration, provider.slug);
    let episodeInfo = parseSeriesInfo(rawName) ?? parseSeriesInfo(group);
    const { title, year } = cleanTitle(rawName);

    // Adres /series/ diyor ama isimde S/E kalıbı yok (bazı paneller böyle):
    // dizi başlığını grup adından alıp bölümleri liste sırasına göre numaralandır.
    if (!episodeInfo && type === "series") {
      const seriesTitle = group ? extractSeriesTitleFromGroup(group, provider.name) : title;
      const key = `${provider.slug}:${normalizeForMatch(seriesTitle)}`;
      const nextEpisode = (sequentialEpisodes.get(key) ?? 0) + 1;
      sequentialEpisodes.set(key, nextEpisode);
      episodeInfo = {
        season: 1,
        episode: nextEpisode,
        label: `S01E${String(nextEpisode).padStart(2, "0")}`,
      };
    }

    const logo = entry.attributes["tvg-logo"] || undefined;
    const tvgId = entry.attributes["tvg-id"] || undefined;

    if (type === "series" && episodeInfo) {
      const seriesTitle = hasSeriesPattern(rawName)
        ? stripEpisodeSuffix(title)
        : extractSeriesTitleFromGroup(group, provider.name) || stripEpisodeSuffix(title);
      const seriesKey = `${provider.slug}:${normalizeForMatch(seriesTitle)}`;
      const seriesId = `sr_${hash(seriesKey)}`;
      const episodeId = `ep_${hash(`${seriesKey}:${episodeInfo.season}:${episodeInfo.episode}:${entry.url}`)}`;

      const item: ContentItem = {
        id: episodeId,
        title: seriesTitle,
        year,
        type: "series",
        providerSlug: provider.slug,
        group,
        category: extractCategory(group, provider.name),
        streamUrl: entry.url,
        logo,
        tvgId,
        playlistId,
        episodeOf: { seriesId, ...episodeInfo },
      };

      itemsById.set(item.id, item);

      const bucket = seriesBuckets.get(seriesId) ?? {
        title: seriesTitle,
        providerSlug: provider.slug,
        group,
        logo,
        year,
        episodes: [],
      };
      if (!bucket.logo && logo) bucket.logo = logo;
      if (!bucket.year && year) bucket.year = year;
      bucket.episodes.push(item);
      seriesBuckets.set(seriesId, bucket);
      continue;
    }

    // Film / canlı / diğer: aynı içerik farklı kalitede tekrar edebilir → tek kayıt + alternatif kaynaklar
    const dedupeKey =
      type === "live" || type === "sports" || type === "news"
        ? `${provider.slug}:${normalizeForMatch(rawName)}` // canlı kanallarda isim birebir anlamlı
        : `${provider.slug}:${normalizeForMatch(title)}:${year ?? ""}`;
    const id = `${type === "movie" ? "mv" : "ch"}_${hash(dedupeKey)}`;

    const existing = itemsById.get(id);
    if (existing) {
      existing.sources = existing.sources ?? [
        { label: "Kaynak 1", url: existing.streamUrl, playlistId: existing.playlistId },
      ];
      if (!existing.sources.some((source) => source.url === entry.url)) {
        existing.sources.push({
          label: qualityLabel(rawName) ?? `Kaynak ${existing.sources.length + 1}`,
          url: entry.url,
          playlistId,
        });
      }
      if (!existing.logo && logo) existing.logo = logo;
      continue;
    }

    itemsById.set(id, {
      id,
      title: type === "live" || type === "sports" || type === "news" ? rawName : title,
      year,
      type,
      providerSlug: provider.slug,
      group,
      category: extractCategory(group, provider.name),
      streamUrl: entry.url,
      logo,
      tvgId,
      country: type === "live" || type === "news" || type === "sports" ? detectCountry(group, rawName) : undefined,
      playlistId,
    });
  }

  const series: SeriesItem[] = [];
  for (const [seriesId, bucket] of seriesBuckets) {
    const seasonMap = new Map<number, Season>();
    for (const episode of bucket.episodes) {
      const ref = episode.episodeOf!;
      const season = seasonMap.get(ref.season) ?? { season: ref.season, episodes: [] };
      if (!season.episodes.some((e) => e.episode === ref.episode)) {
        season.episodes.push({
          id: episode.id,
          seriesId,
          season: ref.season,
          episode: ref.episode,
          title: `${ref.season}. Sezon ${ref.episode}. Bölüm`,
          streamUrl: episode.streamUrl,
          logo: episode.logo,
        });
      }
      seasonMap.set(ref.season, season);
    }

    const seasons = [...seasonMap.values()].sort((a, b) => a.season - b.season);
    for (const season of seasons) season.episodes.sort((a, b) => a.episode - b.episode);

    series.push({
      id: seriesId,
      title: bucket.title,
      year: bucket.year,
      providerSlug: bucket.providerSlug,
      group: bucket.group,
      logo: bucket.logo,
      playlistId: bucket.episodes[0]?.playlistId ?? "",
      seasons,
      episodeCount: seasons.reduce((total, season) => total + season.episodes.length, 0),
    });
  }

  return { items: [...itemsById.values()], series };
}

/** Birden fazla playlist'in çıktısını tek kütüphanede birleştirir. */
export function mergeLibraries(parts: { items: ContentItem[]; series: SeriesItem[] }[]): Library {
  const itemsById = new Map<string, ContentItem>();
  const seriesById = new Map<string, SeriesItem>();

  for (const part of parts) {
    for (const item of part.items) {
      const existing = itemsById.get(item.id);
      if (!existing) {
        itemsById.set(item.id, item);
        continue;
      }
      // Aynı içerik başka playlist'te de var → alternatif kaynak olarak ekle
      existing.sources = existing.sources ?? [
        { label: "Kaynak 1", url: existing.streamUrl, playlistId: existing.playlistId },
      ];
      if (!existing.sources.some((source) => source.url === item.streamUrl)) {
        existing.sources.push({
          label: `Kaynak ${existing.sources.length + 1}`,
          url: item.streamUrl,
          playlistId: item.playlistId,
        });
      }
      if (!existing.logo && item.logo) existing.logo = item.logo;
    }

    for (const item of part.series) {
      const existing = seriesById.get(item.id);
      if (!existing) {
        seriesById.set(item.id, item);
        continue;
      }
      for (const season of item.seasons) {
        const target = existing.seasons.find((s) => s.season === season.season);
        if (!target) {
          existing.seasons.push(season);
          continue;
        }
        for (const episode of season.episodes) {
          if (!target.episodes.some((e) => e.episode === episode.episode)) target.episodes.push(episode);
        }
        target.episodes.sort((a, b) => a.episode - b.episode);
      }
      existing.seasons.sort((a, b) => a.season - b.season);
      existing.episodeCount = existing.seasons.reduce((total, season) => total + season.episodes.length, 0);
    }
  }

  const items = [...itemsById.values()];
  const series = [...seriesById.values()];

  return {
    items,
    series,
    providers: buildProviderStats(items, series),
    counts: countByType(items),
  };
}

function buildProviderStats(items: ContentItem[], series: SeriesItem[]): LibraryProvider[] {
  const stats = new Map<string, { itemCount: number; movieCount: number; seriesCount: number; liveCount: number }>();

  const bump = (slug: string, key: "movieCount" | "seriesCount" | "liveCount") => {
    const entry = stats.get(slug) ?? { itemCount: 0, movieCount: 0, seriesCount: 0, liveCount: 0 };
    entry[key] += 1;
    entry.itemCount += 1;
    stats.set(slug, entry);
  };

  for (const item of items) {
    if (item.type === "series") continue; // dizi bölümleri seri bazında sayılır
    if (item.type === "movie") bump(item.providerSlug, "movieCount");
    else bump(item.providerSlug, "liveCount");
  }
  for (const item of series) bump(item.providerSlug, "seriesCount");

  const all = [...PROVIDERS, OTHER_PROVIDER];
  return all
    .map((provider) => ({
      ...provider,
      itemCount: stats.get(provider.slug)?.itemCount ?? 0,
      movieCount: stats.get(provider.slug)?.movieCount ?? 0,
      seriesCount: stats.get(provider.slug)?.seriesCount ?? 0,
      liveCount: stats.get(provider.slug)?.liveCount ?? 0,
    }))
    .filter((provider) => provider.itemCount > 0)
    .sort((a, b) => b.itemCount - a.itemCount);
}

function countByType(items: ContentItem[]): Record<ContentType, number> {
  const counts: Record<ContentType, number> = {
    movie: 0,
    series: 0,
    live: 0,
    sports: 0,
    news: 0,
    kids: 0,
    other: 0,
  };
  for (const item of items) counts[item.type] += 1;
  return counts;
}

function hasSeriesPattern(rawName: string): boolean {
  return parseSeriesInfo(rawName) !== null;
}

/**
 * Xtream panellerinde S/E taşımayan dizi bölümleri, dizi adını group-title'da tutar:
 * "TR | DİZİLER | Kızılcık Şerbeti" → "Kızılcık Şerbeti"
 */
function extractSeriesTitleFromGroup(group: string, providerName: string): string {
  const parts = group
    .split(/[|/>]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const noise = new Set(
    ["series", "dizi", "diziler", "tv shows", "shows", "vod", providerName].map((value) =>
      normalizeForMatch(value),
    ),
  );

  const meaningful = parts.filter((part) => {
    const normalized = normalizeForMatch(part);
    return normalized.length > 1 && !noise.has(normalized) && normalized.length < 60;
  });

  return meaningful[meaningful.length - 1] ?? "";
}

/** "Breaking Bad S02E04" içindeki başlıkta bölüm adı kaldıysa kırp. */
function stripEpisodeSuffix(title: string): string {
  return title
    .replace(/\s*[-–:]\s*(bolum|bölüm|episode|ep)\s*\d+\s*$/i, "")
    .replace(/\s*\d{1,3}\s*\.\s*(bolum|bölüm)\s*$/i, "")
    .trim();
}

function qualityLabel(rawName: string): string | undefined {
  const match = rawName.match(/\b(4K|UHD|FHD|HD|SD|1080p?|720p?|480p)\b/i);
  return match ? match[1].toUpperCase() : undefined;
}
