import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Büyük listeler yavaş sunuculardan gelebiliyor; Vercel'in varsayılan 10sn'lik
// fonksiyon süresi yetmez.
export const maxDuration = 60;

/**
 * M3U indirme proxy'si.
 *
 * Tarayıcıdan doğrudan M3U çekmek CORS'a takılır (IPTV sağlayıcıları
 * Access-Control-Allow-Origin göndermez). Bu route listeyi sunucu tarafında
 * indirip düz metin olarak client'a verir.
 *
 * POST { url: string } → { text, bytes } | { error, reason }
 *
 * `reason` client'ın ne yapacağını bilmesi için: "blocked" gelirse client aynı
 * adresi kendi IP'sinden denemeyi dener (bkz. lib/store/libraryStore.ts).
 */

/**
 * Bazı paneller VLC'yi, bazıları tarayıcıyı bekler; biri reddederse diğeri denenir.
 */
const USER_AGENTS = [
  "VLC/3.0.20 LibVLC/3.0.20",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Lavf/60.16.100",
];

type FailureReason = "blocked" | "notfound" | "timeout" | "unreachable" | "invalid" | "empty";

export async function POST(request: NextRequest) {
  let payload: { url?: string };
  try {
    payload = await request.json();
  } catch {
    return fail("Geçersiz istek gövdesi", "invalid", 400);
  }

  const rawUrl = payload.url?.trim();
  if (!rawUrl) return fail("Playlist URL'si gerekli", "invalid", 400);

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return fail("URL biçimi geçersiz", "invalid", 400);
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return fail("Sadece http/https adresleri desteklenir", "invalid", 400);
  }

  let lastStatus = 0;
  let timedOut = false;
  let networkError = false;

  for (const userAgent of USER_AGENTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch(target, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": userAgent, Accept: "*/*" },
        cache: "no-store",
      });

      lastStatus = response.status;

      // 403/401 → user-agent yüzünden olabilir, sıradakini dene.
      if (response.status === 403 || response.status === 401) continue;

      if (!response.ok) {
        return fail(
          `Playlist indirilemedi (HTTP ${response.status})`,
          response.status === 404 ? "notfound" : "unreachable",
          502,
        );
      }

      const text = await response.text();

      if (!text.trim()) return fail("Playlist boş döndü", "empty", 422);

      if (!text.includes("#EXTINF") && !text.trimStart().startsWith("#EXTM3U")) {
        return fail(
          "Bu adres M3U listesi gibi görünmüyor (#EXTINF bulunamadı). Sağlayıcı hesabın süresi dolmuş olabilir.",
          "invalid",
          422,
        );
      }

      return NextResponse.json({ text, bytes: text.length });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") timedOut = true;
      else networkError = true;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (timedOut) return fail("Playlist zaman aşımına uğradı (45sn)", "timeout", 504);

  if (lastStatus === 403 || lastStatus === 401) {
    return fail(
      `Sağlayıcı isteği reddetti (HTTP ${lastStatus}). IPTV panelleri genelde veri merkezi IP'lerini ` +
        "engeller — uygulama bir sunucuda (ör. Vercel) çalışıyorsa liste oradan indirilemez.",
      "blocked",
      502,
    );
  }

  return fail(
    networkError ? "Playlist adresine ulaşılamadı" : "Playlist indirilemedi",
    "unreachable",
    502,
  );
}

function fail(error: string, reason: FailureReason, status: number) {
  return NextResponse.json({ error, reason }, { status });
}
