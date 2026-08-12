import { normalizeForMatch } from "@/lib/config/providers";
import type { ContentItem } from "@/lib/types";

/**
 * Canlı kanalları anlamlı kategorilere ayırır.
 *
 * M3U grup adları sağlayıcıdan sağlayıcıya değişir ("TR | SPOR", "SPOR HD",
 * "Turkish Sports", "BEIN SPORTS")— bu yüzden kanalı hem grup adına hem kanal
 * adına bakarak sabit bir kategoriye oturtuyoruz. Sıra önemlidir: yukarıdaki
 * kategori kazanır.
 */
export interface ChannelCategory {
  id: string;
  label: string;
  /** Kart/rozet rengi */
  color: string;
  keywords: string[];
}

export const CHANNEL_CATEGORIES: ChannelCategory[] = [
  {
    id: "sports",
    label: "Spor",
    color: "#16A34A",
    keywords: [
      "spor", "sports", "sport", "bein", "s sport", "tivibu spor", "smart spor", "futbol",
      "football", "soccer", "espn", "dazn", "eurosport", "nba", "nfl", "ufc", "mma", "boks",
      "boxing", "tenis", "tennis", "golf", "motor", "formula", "f1", "moto gp", "basketbol",
      "voleybol", "sportklub", "sport tv", "arena", "premier", "laliga", "seriea", "trt spor",
    ],
  },
  {
    id: "news",
    label: "Haber",
    color: "#DC2626",
    keywords: [
      "haber", "news", "cnn", "ntv", "bbc news", "sky news", "aljazeera", "al jazeera",
      "euronews", "bloomberg", "a haber", "halk tv", "tele1", "sozcu", "tgrt haber", "24 tv",
      "haberturk", "trt haber", "fox news", "msnbc", "france 24", "dw",
    ],
  },
  {
    id: "kids",
    label: "Çocuk",
    color: "#F59E0B",
    keywords: [
      "cocuk", "kids", "cizgi", "cartoon", "nickelodeon", "nick jr", "disney junior",
      "disney channel", "minika", "trt cocuk", "baby tv", "boomerang", "duck tv", "anime",
      "animasyon", "junior", "kika", "pop kids",
    ],
  },
  {
    id: "documentary",
    label: "Belgesel",
    color: "#0EA5E9",
    keywords: [
      "belgesel", "documentary", "discovery", "national geographic", "nat geo", "history",
      "animal planet", "dmax", "tlc", "viasat", "love nature", "curiosity", "trt belgesel",
    ],
  },
  {
    id: "movies",
    label: "Sinema",
    color: "#7C3AED",
    keywords: [
      "sinema", "movie", "movies", "film", "cinema", "moviemax", "filmbox", "cinemax",
      "hbo", "star movies", "tv1000", "dizi", "series channel", "fx", "amc", "tnt",
    ],
  },
  {
    id: "music",
    label: "Müzik",
    color: "#EC4899",
    keywords: [
      "muzik", "music", "mtv", "kral", "powerturk", "power turk", "number1", "number 1",
      "dream turk", "vh1", "mezzo", "trt muzik", "radyo", "radio",
    ],
  },
  {
    id: "religion",
    label: "Dini",
    color: "#65A30D",
    keywords: ["dini", "religious", "diyanet", "kuran", "islam", "mekke", "medine", "quran", "semerkand"],
  },
  {
    id: "adult",
    label: "Yetişkin",
    color: "#7F1D1D",
    keywords: ["adult", "yetiskin", "xxx", "erotic", "erotik", "18+", "playboy", "hustler", "brazzers"],
  },
  {
    id: "national",
    label: "Ulusal",
    color: "#2563EB",
    keywords: [
      "ulusal", "national", "trt 1", "trt1", "atv", "show tv", "kanal d", "star tv", "tv8",
      "now tv", "fox tv", "kanal 7", "beyaz tv", "tv 360", "teve2", "dmax", "tr genel",
      "turkiye", "turkey", "yerel", "genel",
    ],
  },
];

export const OTHER_CATEGORY: ChannelCategory = {
  id: "other",
  label: "Diğer",
  color: "#4B5563",
  keywords: [],
};

/** Kanalın kategorisi. Önce içerik tipi, sonra grup adı, sonra kanal adı. */
export function categorizeChannel(channel: ContentItem): ChannelCategory {
  if (channel.type === "sports") return byId("sports");
  if (channel.type === "news") return byId("news");
  if (channel.type === "kids") return byId("kids");

  const group = normalizeForMatch(channel.group ?? "");
  const name = normalizeForMatch(channel.title ?? "");

  for (const category of CHANNEL_CATEGORIES) {
    if (category.keywords.some((keyword) => containsWord(group, keyword))) return category;
  }
  for (const category of CHANNEL_CATEGORIES) {
    if (category.keywords.some((keyword) => containsWord(name, keyword))) return category;
  }

  return OTHER_CATEGORY;
}

export interface CategorizedChannels {
  category: ChannelCategory;
  channels: ContentItem[];
}

/** Kanalları kategorilere böler; boş kategoriler döndürülmez. */
export function groupChannelsByCategory(channels: ContentItem[]): CategorizedChannels[] {
  const buckets = new Map<string, ContentItem[]>();

  for (const channel of channels) {
    const category = categorizeChannel(channel);
    const bucket = buckets.get(category.id) ?? [];
    bucket.push(channel);
    buckets.set(category.id, bucket);
  }

  const ordered = [...CHANNEL_CATEGORIES, OTHER_CATEGORY];
  return ordered
    .filter((category) => (buckets.get(category.id)?.length ?? 0) > 0)
    .map((category) => ({ category, channels: buckets.get(category.id) ?? [] }));
}

function byId(id: string): ChannelCategory {
  return CHANNEL_CATEGORIES.find((category) => category.id === id) ?? OTHER_CATEGORY;
}

function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(haystack);
}
