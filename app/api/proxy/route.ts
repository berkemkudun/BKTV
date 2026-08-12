import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// HLS segmentleri kısa isteklerdir; tek parça MP4 aktarımında ise bu süre üst sınırdır.
export const maxDuration = 60;

/**
 * Stream proxy'si (opsiyonel — Ayarlar > Oynatıcı'dan açılır, hata alınca otomatik denenir).
 *
 * Çoğu IPTV kaynağı CORS başlığı göndermediği için tarayıcı HLS oynatmayı reddeder.
 * Bu route:
 *  - .m3u8 playlist'lerini indirir, içindeki göreli URL'leri mutlak hale getirip
 *    yine bu proxy'ye yönlendirir (böylece segment istekleri de CORS'suz gider)
 *  - segment/video isteklerini (ts, mp4, key) Range desteğiyle olduğu gibi aktarır
 *
 * GET /api/proxy?url=<encoded>
 */
export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "url parametresi gerekli" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Geçersiz url" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Sadece http/https desteklenir" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
    Accept: "*/*",
  };
  const range = request.headers.get("range");
  if (range) headers.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target, { headers, redirect: "follow", cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Kaynağa ulaşılamadı" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: `Kaynak hatası (HTTP ${upstream.status})` }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const finalUrl = upstream.url || target.toString();
  const isPlaylist =
    /mpegurl|x-mpegURL/i.test(contentType) || /\.m3u8(\?|$)/i.test(new URL(finalUrl).pathname);

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, finalUrl);
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const passthrough = new Headers();
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(header);
    if (value) passthrough.set(header, value);
  }
  passthrough.set("Cache-Control", "no-store");
  passthrough.set("Access-Control-Allow-Origin", "*");

  return new NextResponse(upstream.body, { status: upstream.status, headers: passthrough });
}

/** Playlist içindeki tüm göreli/mutlak URL'leri proxy üzerinden geçecek şekilde yeniden yazar. */
function rewritePlaylist(text: string, baseUrl: string): string {
  const toProxy = (value: string) => {
    try {
      const absolute = new URL(value, baseUrl).toString();
      return `/api/proxy?url=${encodeURIComponent(absolute)}`;
    } catch {
      return value;
    }
  };

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        // #EXT-X-KEY:URI="...", #EXT-X-MAP:URI="..." gibi gömülü adresler
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${toProxy(uri)}"`);
      }

      return toProxy(trimmed);
    })
    .join("\n");
}
