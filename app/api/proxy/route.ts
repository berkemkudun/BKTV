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

  const range = request.headers.get("range");

  /*
   * Paneller user-agent konusunda tutarsız: kimi yalnızca VLC'yi, kimi yalnızca
   * tarayıcıyı kabul ediyor; bazıları da canlı yayında Range isteğine 403 dönüyor.
   * 401/403 alınırsa aynı adres farklı kombinasyonlarla bir kez daha denenir.
   */
  const attempts: { userAgent: string; withRange: boolean }[] = [
    { userAgent: "VLC/3.0.20 LibVLC/3.0.20", withRange: true },
    {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      withRange: true,
    },
    { userAgent: "Lavf/60.16.100", withRange: false },
  ];

  let upstream: Response | null = null;
  let lastStatus = 0;

  for (const attempt of attempts) {
    const headers: Record<string, string> = {
      "User-Agent": attempt.userAgent,
      Accept: "*/*",
    };
    if (range && attempt.withRange) headers.Range = range;

    let response: Response;
    try {
      response = await fetch(target, { headers, redirect: "follow", cache: "no-store" });
    } catch {
      continue;
    }

    if (response.ok || response.status === 206) {
      upstream = response;
      break;
    }

    lastStatus = response.status;
    void response.body?.cancel();
    // Yalnızca "reddedildi" hallerinde tekrar denemek anlamlı.
    if (response.status !== 401 && response.status !== 403 && response.status !== 416) break;
  }

  if (!upstream) {
    if (!lastStatus) return NextResponse.json({ error: "Kaynağa ulaşılamadı" }, { status: 502 });
    return NextResponse.json({ error: `Kaynak hatası (HTTP ${lastStatus})` }, { status: 502 });
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
