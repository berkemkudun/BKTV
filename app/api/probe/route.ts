import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Yayın tanı ucu.
 *
 * Oynatma başarısız olduğunda "neden" sorusunu tahmin etmek yerine ölçüyoruz:
 * adresi sunucudan çekip yalnızca BAŞLIKLARI okuyoruz (gövde indirilmez).
 * Böylece "sağlayıcı 503 veriyor" ile "tarayıcı kodeki açamıyor" ayırt edilebiliyor.
 *
 * GET /api/probe?url=<encoded>
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
    return NextResponse.json({ error: "Sadece http/https" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Accept: "*/*",
        // İlk baytı iste: canlı yayınlarda tüm gövdeyi indirmeyi engeller.
        Range: "bytes=0-0",
      },
      cache: "no-store",
    });

    // Gövdeyi okumadan bırak.
    void response.body?.cancel();

    return NextResponse.json({
      reachable: true,
      status: response.status,
      ok: response.ok || response.status === 206,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      acceptRanges: response.headers.get("accept-ranges"),
      cors: response.headers.get("access-control-allow-origin"),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({
      reachable: false,
      timedOut: aborted,
      status: 0,
      ok: false,
    });
  } finally {
    clearTimeout(timeout);
  }
}
