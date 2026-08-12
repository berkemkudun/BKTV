import type { RawEntry } from "@/lib/types";

/**
 * Esnek M3U / M3U8 parser.
 *
 * Desteklenenler:
 *  - #EXTM3U başlığı (opsiyonel — bazı listeler hiç göndermez)
 *  - #EXTINF:<duration> <attr="value" ...>,<display name>
 *  - #EXTGRP:<group>            (group-title alternatifi)
 *  - #EXTVLCOPT / #KODIPROP     (yok sayılır ama satır akışını bozmaz)
 *  - Tırnaksız attribute değerleri (tvg-id=abc)
 *  - CRLF / LF / eksik son satır
 *
 * Bilinçli tercih: satır satır tarama + regex yerine manuel attribute tarayıcı.
 * 100k satırlık listelerde regex backtracking'i engeller.
 */
export function parseM3U(text: string): RawEntry[] {
  const entries: RawEntry[] = [];
  const lines = text.split(/\r?\n/);

  let pending: { attributes: Record<string, string>; name: string; duration: number } | null = null;
  let pendingGroup = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      pending = parseExtInf(line);
      pendingGroup = "";
      continue;
    }

    if (line.startsWith("#EXTGRP")) {
      pendingGroup = line.slice(line.indexOf(":") + 1).trim();
      continue;
    }

    // Diğer tüm direktifler (#EXTM3U, #EXTVLCOPT, #KODIPROP, yorumlar) atlanır.
    if (line.startsWith("#")) continue;

    if (!pending) continue; // URL'siz / EXTINF'siz başıboş satır

    const group = pending.attributes["group-title"] || pendingGroup || "";
    entries.push({
      attributes: pending.attributes,
      name: pending.name,
      duration: pending.duration,
      url: line,
      group,
    });
    pending = null;
    pendingGroup = "";
  }

  return entries;
}

function parseExtInf(line: string): { attributes: Record<string, string>; name: string; duration: number } {
  const colon = line.indexOf(":");
  const body = colon === -1 ? "" : line.slice(colon + 1);

  // Attribute bölümü tırnak dışındaki İLK virgülde biter; sonrası başlıktır.
  // (Başlıklar sık sık virgül içerir: "Lock, Stock and Two Smoking Barrels")
  let inQuotes = false;
  let commaIdx = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      commaIdx = i;
      break;
    }
  }

  const head = commaIdx === -1 ? body : body.slice(0, commaIdx);
  const name = commaIdx === -1 ? "" : body.slice(commaIdx + 1).trim();

  const durationMatch = head.match(/^\s*(-?\d+(?:\.\d+)?)/);
  const duration = durationMatch ? Number(durationMatch[1]) : -1;

  const attrStart = durationMatch ? durationMatch[0].length : 0;
  const attributes = parseAttributes(head.slice(attrStart));

  return { attributes, name, duration };
}

/** `tvg-id="x" tvg-name='y' group-title=z` → { "tvg-id": "x", ... } */
function parseAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let i = 0;

  while (i < input.length) {
    while (i < input.length && /[\s,]/.test(input[i])) i++;
    const keyStart = i;
    while (i < input.length && input[i] !== "=" && !/\s/.test(input[i])) i++;
    if (i >= input.length || input[i] !== "=") {
      // "=" yoksa geçerli bir attribute değil; sonraki boşluğa atla.
      if (i === keyStart) i++;
      continue;
    }
    const key = input.slice(keyStart, i).trim().toLowerCase();
    i++; // "=" atla

    let value = "";
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      i++;
      const start = i;
      while (i < input.length && input[i] !== quote) i++;
      value = input.slice(start, i);
      i++; // kapanış tırnağı
    } else {
      const start = i;
      while (i < input.length && !/\s/.test(input[i])) i++;
      value = input.slice(start, i);
    }

    if (key) attrs[key] = value;
  }

  return attrs;
}

/**
 * Büyük listeleri UI thread'ini bloklamadan parse eder.
 * Worker kullanılamıyorsa (SSR, eski tarayıcı) chunk'lara bölüp event loop'a nefes aldırır.
 */
export async function parseM3UChunked(
  text: string,
  onProgress?: (parsed: number) => void,
): Promise<RawEntry[]> {
  const lines = text.split(/\r?\n/);
  const CHUNK = 5000;
  const entries: RawEntry[] = [];

  for (let start = 0; start < lines.length; start += CHUNK) {
    // Chunk sınırında yarım kalan EXTINF olmaması için 1 satır geri sarma yapmıyoruz;
    // bunun yerine chunk'ı metin olarak birleştirip parse ediyoruz.
    const slice = lines.slice(start, start + CHUNK + 1).join("\n");
    const parsed = parseM3U(slice);
    // Son kayıt bir sonraki chunk'ın ilk satırıyla tekrar üretilebilir; url ile dedupe et.
    for (const entry of parsed) {
      const last = entries[entries.length - 1];
      if (last && last.url === entry.url && last.name === entry.name) continue;
      entries.push(entry);
    }
    onProgress?.(entries.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return entries;
}
