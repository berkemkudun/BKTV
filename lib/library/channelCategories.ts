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
  /**
   * Jenerik kova ("General", "Undefined", "Yaşam"…). Grup adı buraya uysa bile
   * önce kanal adının özel bir kategoriye (spor, haber, ulusal…) uyup uymadığına
   * bakılır; aksi halde "General" grubundaki TRT 1 de eğlenceye düşerdi.
   */
  generic?: boolean;
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
      "now tv", "fox tv", "kanal 7", "beyaz tv", "tv 360", "teve2", "tr genel",
      "turkiye", "turkey", "turkish", "yerel", "tv2", "tv 2", "360 tv",
      "flash tv", "ulke tv", "tv5", "meltem", "kanal b",
    ],
  },
  {
    /*
     * Gerçek listelerde kanalların büyük kısmı "General / Entertainment /
     * Undefined / Yaşam" gibi jenerik gruplarda gelir; bunlar kategorisiz
     * kalınca Canlı TV'de her şey "Diğer" kovasında toplanıyordu.
     */
    id: "entertainment",
    label: "Genel & Eğlence",
    color: "#F97316",
    generic: true,
    keywords: [
      "eglence", "entertainment", "yasam", "lifestyle", "magazin", "reality", "yemek", "food",
      "moda", "fashion", "seyahat", "travel", "kultur", "culture", "egitim", "education",
      "bilgi", "knowledge", "ekonomi", "business", "finans", "finance", "undefined",
      "tanimsiz", "diger", "other", "misc", "various", "genel", "general", "series",
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

  const specific = CHANNEL_CATEGORIES.filter((category) => !category.generic);
  const generic = CHANNEL_CATEGORIES.filter((category) => category.generic);

  const match = (haystack: string, list: ChannelCategory[]) =>
    list.find((category) => category.keywords.some((keyword) => containsWord(haystack, keyword)));

  // 1) Grup adı özel bir kategoriye uyuyor mu? ("TR | SPOR")
  // 2) Kanal adı? ("beIN Sports 1" — grubu "General" olsa bile)
  // 3) Grup jenerik bir kovaya uyuyor mu? ("General", "Undefined")
  return (
    match(group, specific) ?? match(name, specific) ?? match(group, generic) ?? OTHER_CATEGORY
  );
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
