/**
 * Altyazı yardımcıları.
 *
 * Tarayıcılar yalnızca WebVTT'yi <track> ile gösterebilir. IPTV kaynaklarında
 * altyazılar genelde ya HLS içinde gömülü gelir (hls.js bunu kendi yönetir) ya da
 * kullanıcının elindeki .srt dosyasındadır — .srt'yi burada VTT'ye çeviriyoruz.
 */

/** SubRip (.srt) metnini WebVTT'ye çevirir. */
export function srtToVtt(input: string): string {
  const body = input
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    // 00:00:01,234 --> 00:00:03,456   (virgül yerine nokta)
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    // Satır numaralarını at (VTT'de cue id opsiyonel, numara zararsız ama gereksiz)
    .replace(/^\d+\n(?=\d{2}:\d{2}:\d{2})/gm, "");

  return `WEBVTT\n\n${body.trim()}\n`;
}

/** Dosyadan altyazı yükler ve <track src> olarak kullanılabilir bir blob URL döner. */
export async function subtitleFileToUrl(file: File): Promise<string> {
  const text = await file.text();
  const isVtt = /^\s*WEBVTT/.test(text) || file.name.toLowerCase().endsWith(".vtt");
  const vtt = isVtt ? text : srtToVtt(text);
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
}

/** BCP-47 / ISO kodlarını okunur hale getirir: "tr" → "Türkçe" */
export function languageLabel(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  const normalized = code.toLowerCase().split(/[-_]/)[0];
  const names: Record<string, string> = {
    tr: "Türkçe",
    en: "İngilizce",
    de: "Almanca",
    fr: "Fransızca",
    es: "İspanyolca",
    it: "İtalyanca",
    ar: "Arapça",
    ru: "Rusça",
    az: "Azerbaycanca",
    ku: "Kürtçe",
    nl: "Hollandaca",
    pt: "Portekizce",
    fa: "Farsça",
    el: "Yunanca",
    bg: "Bulgarca",
    ro: "Rumence",
    sq: "Arnavutça",
    und: "Bilinmiyor",
  };
  return names[normalized] ?? fallback;
}
