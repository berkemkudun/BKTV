import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * M3U indirme proxy'si.
 *
 * Tarayıcıdan doğrudan M3U çekmek CORS'a takılır (IPTV sağlayıcıları
 * Access-Control-Allow-Origin göndermez). Bu route listeyi sunucu tarafında
 * indirip düz metin olarak client'a verir.
 *
 * POST { url: string } → { text, bytes, contentType }
 */
export async function POST(request: NextRequest) {
  let payload: { url?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const rawUrl = payload.url?.trim();
  if (!rawUrl) return NextResponse.json({ error: "Playlist URL'si gerekli" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "URL biçimi geçersiz" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Sadece http/https adresleri desteklenir" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Bazı IPTV panelleri tarayıcı dışı user-agent'ları reddeder.
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Accept: "*/*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Playlist indirilemedi (HTTP ${response.status})` },
        { status: 502 },
      );
    }

    const text = await response.text();

    if (!text.trim()) {
      return NextResponse.json({ error: "Playlist boş döndü" }, { status: 422 });
    }

    const looksLikeM3U = text.includes("#EXTINF") || text.trimStart().startsWith("#EXTM3U");
    if (!looksLikeM3U) {
      return NextResponse.json(
        { error: "Bu adres M3U listesi gibi görünmüyor (#EXTINF bulunamadı)" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text,
      bytes: text.length,
      contentType: response.headers.get("content-type") ?? "text/plain",
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Playlist zaman aşımına uğradı (45sn)" : "Playlist adresine ulaşılamadı" },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
