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

  /*
   * Tek deneme yanıltıcı olabiliyor:
   *  - Bazı paneller canlı TS yayınında Range isteğine 403/416 dönüyor
   *    (yayın aslında çalışıyor) — Range'siz tekrar denenir.
   *  - Bazıları VLC user-agent'ını reddedip tarayıcı UA'sını kabul ediyor.
   * Bu yüzden birkaç kombinasyon denenip EN İYİ sonuç raporlanır.
   */
  const attempts: { userAgent: string; range: boolean }[] = [
    { userAgent: "VLC/3.0.20 LibVLC/3.0.20", range: true },
    { userAgent: "VLC/3.0.20 LibVLC/3.0.20", range: false },
    {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      range: false,
    },
  ];

  let best: {
    reachable: boolean;
    timedOut?: boolean;
    status: number;
    ok: boolean;
    contentType?: string | null;
    contentLength?: string | null;
    acceptRanges?: string | null;
    cors?: string | null;
  } | null = null;

  const deadline = Date.now() + 25_000;

  for (const attempt of attempts) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(remaining, 12_000));

    const headers: Record<string, string> = {
      "User-Agent": attempt.userAgent,
      Accept: "*/*",
    };
    // İlk baytı iste: canlı yayınlarda tüm gövdeyi indirmeyi engeller.
    if (attempt.range) headers.Range = "bytes=0-0";

    try {
      const response = await fetch(target, {
        signal: controller.signal,
        redirect: "follow",
        headers,
        cache: "no-store",
      });

      // Gövdeyi okumadan bırak.
      void response.body?.cancel();

      const result = {
        reachable: true,
        status: response.status,
        ok: response.ok || response.status === 206,
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
        acceptRanges: response.headers.get("accept-ranges"),
        cors: response.headers.get("access-control-allow-origin"),
      };

      if (result.ok) return NextResponse.json(result);
      // Başarısızsa sakla ama denemeye devam et (belki başka UA/Range çalışır).
      if (!best || (!best.reachable && result.reachable)) best = result;
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      if (!best) best = { reachable: false, timedOut: aborted, status: 0, ok: false };
    } finally {
      clearTimeout(timeout);
    }
  }

  return NextResponse.json(best ?? { reachable: false, status: 0, ok: false });
}
