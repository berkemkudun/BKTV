import type { Provider } from "@/lib/types";

/**
 * Provider normalization konfigürasyonu.
 *
 * M3U listeleri standart değildir: "VOD | NETFLIX 4K", "Movies - netflix",
 * "NF Dizi" gibi yüzlerce varyasyon çıkar. Burada tanımlanan `aliases`
 * listesi, normalize edilmiş (küçük harf, noktalama temizlenmiş) grup adı
 * içinde aranır. Yeni bir platform eklemek için sadece bu diziye ekleyin.
 *
 * Sıra önemlidir: daha spesifik alias'lar üstte olmalı ("apple tv" vs "tv").
 */
export const PROVIDERS: Provider[] = [
  {
    id: "netflix",
    name: "Netflix",
    slug: "netflix",
    color: "#E50914",
    aliases: ["netflix", "netflx", "nflx", "nf dizi", "nf film", "n f l x"],
  },
  {
    id: "prime-video",
    name: "Prime Video",
    slug: "prime-video",
    color: "#1FA2FF",
    aliases: ["prime video", "primevideo", "amazon prime", "amazon", "prime vod", "prime"],
  },
  {
    id: "disney-plus",
    name: "Disney+",
    slug: "disney-plus",
    color: "#0B3D91",
    aliases: ["disney plus", "disney+", "disneyplus", "disney", "star plus", "hotstar"],
  },
  {
    id: "max",
    name: "Max",
    slug: "max",
    color: "#7B2BF9",
    aliases: ["hbo max", "hbomax", "hbo", "max"],
  },
  {
    id: "apple-tv-plus",
    name: "Apple TV+",
    slug: "apple-tv-plus",
    color: "#111827",
    aliases: ["apple tv plus", "apple tv+", "appletv", "apple tv", "apple"],
  },
  {
    id: "blutv",
    name: "BluTV",
    slug: "blutv",
    color: "#0EA5E9",
    aliases: ["blutv", "blu tv"],
  },
  {
    id: "exxen",
    name: "Exxen",
    slug: "exxen",
    color: "#F59E0B",
    aliases: ["exxen"],
  },
  {
    id: "gain",
    name: "Gain",
    slug: "gain",
    color: "#22C55E",
    aliases: ["gain"],
  },
  {
    id: "tabii",
    name: "tabii",
    slug: "tabii",
    color: "#06B6D4",
    aliases: ["tabii", "trt tabii"],
  },
  {
    id: "youtube",
    name: "YouTube",
    slug: "youtube",
    color: "#FF0000",
    aliases: ["youtube", "yt premium"],
  },
  {
    id: "hulu",
    name: "Hulu",
    slug: "hulu",
    color: "#1CE783",
    aliases: ["hulu"],
  },
  {
    id: "paramount-plus",
    name: "Paramount+",
    slug: "paramount-plus",
    color: "#0064FF",
    aliases: ["paramount plus", "paramount+", "paramount"],
  },
  {
    id: "peacock",
    name: "Peacock",
    slug: "peacock",
    color: "#F97316",
    aliases: ["peacock"],
  },
  {
    id: "sports",
    name: "Spor",
    slug: "sports",
    color: "#16A34A",
    aliases: [
      "sports",
      "spor",
      "bein",
      "bein sports",
      "s sport",
      "tivibu spor",
      "futbol",
      "football",
      "espn",
      "dazn",
      "sport",
    ],
  },
  {
    id: "live-tv",
    name: "Canlı TV",
    slug: "live-tv",
    color: "#DC2626",
    aliases: ["live tv", "canli tv", "canli yayin", "tv channels", "kanallar", "iptv", "live"],
  },
];

/** Hiçbir provider'a eşleşmeyen içerikler buraya düşer. */
export const OTHER_PROVIDER: Provider = {
  id: "other",
  name: "Diğer",
  slug: "other",
  color: "#4B5563",
  aliases: [],
};

const PROVIDER_BY_SLUG = new Map<string, Provider>(
  [...PROVIDERS, OTHER_PROVIDER].map((p) => [p.slug, p]),
);

export function getProvider(slug: string): Provider | undefined {
  return PROVIDER_BY_SLUG.get(slug);
}

/**
 * Grup adı / kanal adı içinden platform tespiti.
 * Girdi ham olabilir: "VOD | Netflix 4K - Aksiyon"
 */
export function detectProvider(...candidates: (string | undefined)[]): Provider {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const haystack = normalizeForMatch(candidate);
    for (const provider of PROVIDERS) {
      for (const alias of provider.aliases) {
        if (containsToken(haystack, alias)) return provider;
      }
    }
  }
  return OTHER_PROVIDER;
}

/** "VOD | NETFLIX 4K" -> "vod netflix 4k" */
export function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[şs]/g, "s")
    .replace(/[ıi]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

/** Kelime sınırına saygılı arama: "max" -> "maxi" ile eşleşmez. */
function containsToken(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = idx === 0 ? " " : haystack[idx - 1];
  const afterIdx = idx + needle.length;
  const after = afterIdx >= haystack.length ? " " : haystack[afterIdx];
  const isBoundary = (ch: string) => !/[a-z0-9]/.test(ch);
  return isBoundary(before) && isBoundary(after);
}
