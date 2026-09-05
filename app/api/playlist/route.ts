import { NextRequest, NextResponse } from "next/server";

import { playlistUrlVariants } from "@/lib/xtream/url";

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

  /**
   * Aynı hesabın farklı adres varyantları sırayla denenir: paneller
   * `output=m3u8`e 404, `output=ts`ye 200 dönebiliyor (ve tersi).
   * Bu, "liste eklenmiyor / 404 dönüyor" şikayetlerinin en yaygın sebebi.
   */
  const candidates = playlistUrlVariants(target.toString());

  // Vercel fonksiyon süresi 60sn; toplam bütçeyi aşmadan birkaç varyant deneriz.
  const deadline = Date.now() + 50_000;

  let lastStatus = 0;
  let notFound = false;
  let invalidBody = false;
  let timedOut = false;
  let networkError = false;
  let blocked = false;

  for (const candidate of candidates) {
    if (Date.now() > deadline - 4_000) break;

    for (const userAgent of USER_AGENTS) {
      const remaining = deadline - Date.now();
      if (remaining < 4_000) break;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(remaining, 30_000));

      try {
        const response = await fetch(candidate, {
          signal: controller.signal,
          redirect: "follow",
          headers: { "User-Agent": userAgent, Accept: "*/*" },
          cache: "no-store",
        });

        lastStatus = response.status;

        // 403/401 → user-agent yüzünden olabilir, sıradakini dene.
        if (response.status === 403 || response.status === 401) {
          blocked = true;
          continue;
        }

        if (!response.ok) {
          if (response.status === 404) notFound = true;
          break; // bu adres için user-agent değiştirmek anlamsız — sıradaki varyanta geç
        }

        const text = await response.text();

        if (!text.trim()) {
          invalidBody = true;
          break;
        }

        if (!text.includes("#EXTINF") && !text.trimStart().startsWith("#EXTM3U")) {
          invalidBody = true;
          break;
        }

        return NextResponse.json({ text, bytes: text.length, url: candidate });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") timedOut = true;
        else networkError = true;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  const tried = candidates.length > 1 ? ` (${candidates.length} adres varyantı denendi)` : "";

  if (blocked && (lastStatus === 403 || lastStatus === 401)) {
    return fail(
      `Sağlayıcı isteği reddetti (HTTP ${lastStatus}). IPTV panelleri genelde veri merkezi IP'lerini ` +
        "engeller — uygulama bir sunucuda (ör. Vercel) çalışıyorsa liste oradan indirilemez.",
      "blocked",
      502,
    );
  }

  if (notFound) {
    return fail(
      `Sağlayıcı bu adres için 404 döndü${tried}. Genelde şu üçünden biridir: abonelik süresi dolmuş, ` +
        "kullanıcı adı/şifre değişmiş ya da liste adresi artık geçerli değil. Panel bilgilerinle " +
        "“Panel Girişi” sekmesinden bağlanmayı dene — doğru liste adresi otomatik üretilir.",
      "notfound",
      502,
    );
  }

  if (invalidBody) {
    return fail(
      `Adres yanıt veriyor ama M3U listesi döndürmüyor${tried} (#EXTINF bulunamadı). ` +
        "Sağlayıcı hesabın süresi dolmuş ya da adres bir liste adresi değil olabilir.",
      "invalid",
      422,
    );
  }

  if (timedOut) return fail("Playlist zaman aşımına uğradı", "timeout", 504);

  return fail(
    networkError ? "Playlist adresine ulaşılamadı" : `Playlist indirilemedi${tried}`,
    "unreachable",
    502,
  );
}

function fail(error: string, reason: FailureReason, status: number) {
  return NextResponse.json({ error, reason }, { status });
}
