import { normalizeForMatch } from "@/lib/config/providers";
import type { ContentItem, SeriesItem } from "@/lib/types";

/**
 * Türkçe içerik tespiti ve önceliklendirme.
 *
 * Gerçek IPTV listeleri onlarca ülkenin kanalını bir arada verir; kullanıcı
 * pratikte yalnızca Türkçe kanalları izliyor. Bu yüzden Türkçe içerik hem
 * listelerin başına alınır hem de Canlı TV'de tek dokunuşluk bir filtreye
 * bağlanır.
 *
 * Tespit iki kaynağa bakar:
 *  1. `country` alanı — parse sırasında grup/kanal adından çıkarılır (detectCountry)
 *  2. Grup ve başlıktaki Türkçe işaretçileri — "TR |", "TÜRK", "ULUSAL", bayrak…
 */

/** Kelime olarak arandığında Türkçe içeriği işaretleyen ipuçları. */
const TR_WORDS = [
  "tr",
  "tur",
  "turk",
  "turkce",
  "turkiye",
  "turkey",
  "turkish",
  "ulusal",
  "yerel",
  "trt",
];

/** Başlıkta/grupta geçtiğinde Türkçe sayılan alt diziler (kelime sınırı aranmaz). */
const TR_SUBSTRINGS = ["turkiye", "turkce", "turkish", "turk "];

export function isTurkishText(...values: (string | undefined)[]): boolean {
  const haystack = normalizeForMatch(values.filter(Boolean).join(" "));
  if (!haystack) return false;
  if (TR_SUBSTRINGS.some((needle) => haystack.includes(needle))) return true;
  return TR_WORDS.some((word) => new RegExp(`(^| )${word}( |$)`).test(haystack));
}

export function isTurkishItem(item: ContentItem): boolean {
  if (item.country === "TR") return true;
  return isTurkishText(item.group, item.title);
}

export function isTurkishSeries(item: SeriesItem): boolean {
  return isTurkishText(item.group, item.title);
}

/**
 * Türkçe olanları başa alır, geri kalanın sırasını korur.
 * (Array.prototype.sort modern motorlarda kararlıdır.)
 */
export function turkishFirst<T>(items: T[], predicate: (item: T) => boolean): T[] {
  let seenForeign = false;
  let needsSort = false;
  for (const item of items) {
    if (predicate(item)) {
      if (seenForeign) {
        needsSort = true;
        break;
      }
    } else {
      seenForeign = true;
    }
  }
  // Zaten sıradaysa yeni dizi üretme: referans değişimi gereksiz render doğurur.
  if (!needsSort) return items;

  return [...items].sort((a, b) => Number(predicate(b)) - Number(predicate(a)));
}
