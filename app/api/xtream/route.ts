import { NextRequest, NextResponse } from "next/server";

import { buildPlaylistUrl, normalizeHost } from "@/lib/xtream/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Xtream Codes panel girişi.
 *
 * Kullanıcı M3U adresini bulmak zorunda kalmasın diye sunucu + kullanıcı adı + şifre
 * ile bağlanılır. `player_api.php` hesabı doğrular ve şu üç kritik bilgiyi verir:
 *   - hesabın geçerli olup olmadığı ve bitiş tarihi
 *   - `max_connections` / `active_cons` → 503'lerin en yaygın sebebi
 *   - `allowed_output_formats` → panel m3u8 veriyorsa listeyi HLS olarak isteriz
 *     (ham .ts yayınlar tarayıcıda çok daha zor açılıyor)
 *
 * POST { host, username, password } → { account, playlistUrl }
 */
export async function POST(request: NextRequest) {
  let payload: { host?: string; username?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const username = payload.username?.trim();
  const password = payload.password?.trim();
  if (!payload.host?.trim() || !username || !password) {
    return NextResponse.json({ error: "Sunucu adresi, kullanıcı adı ve şifre gerekli" }, { status: 400 });
  }

  const base = normalizeHost(payload.host);
  if (!base) {
    return NextResponse.json(
      { error: "Sunucu adresi anlaşılamadı. Örnek: http://ornek.net:8080" },
      { status: 400 },
    );
  }

  const apiUrl = new URL(`${base}/player_api.php`);
  apiUrl.searchParams.set("username", username);
  apiUrl.searchParams.set("password", password);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let data: XtreamApiResponse;
  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "application/json,*/*" },
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Panel yanıt vermedi (HTTP ${response.status}). Sunucu adresini kontrol et.` },
        { status: 502 },
      );
    }

    const text = await response.text();
    try {
      data = JSON.parse(text) as XtreamApiResponse;
    } catch {
      return NextResponse.json(
        { error: "Bu adres bir Xtream paneli gibi görünmüyor (player_api.php JSON döndürmedi)." },
        { status: 422 },
      );
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Panel 20 saniyede yanıt vermedi" : "Sunucuya ulaşılamadı" },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const info = data.user_info;
  if (!info || Number(info.auth) !== 1) {
    return NextResponse.json(
      { error: "Kullanıcı adı veya şifre hatalı (panel girişi reddetti)." },
      { status: 401 },
    );
  }

  const status = (info.status ?? "").toLowerCase();
  if (status && status !== "active") {
    return NextResponse.json(
      { error: `Hesap aktif değil (panel durumu: ${info.status}).` },
      { status: 403 },
    );
  }

  // Panel m3u8 veriyorsa onu iste: ham .ts yayınlar tarayıcıda çok daha sorunlu.
  const formats = (info.allowed_output_formats ?? []).map((format) => format.toLowerCase());
  const output = formats.includes("m3u8") ? "m3u8" : "ts";

  const playlistUrl = buildPlaylistUrl(base, username, password, output);

  return NextResponse.json({
    playlistUrl,
    account: {
      host: base,
      username,
      status: info.status ?? "Active",
      isTrial: info.is_trial === "1",
      expiresAt: info.exp_date ? Number(info.exp_date) * 1000 : null,
      maxConnections: info.max_connections ? Number(info.max_connections) : null,
      activeConnections: info.active_cons !== undefined ? Number(info.active_cons) : null,
      outputFormat: output,
      allowedFormats: formats,
    },
  });
}

interface XtreamApiResponse {
  user_info?: {
    auth?: number | string;
    status?: string;
    exp_date?: string | null;
    is_trial?: string;
    active_cons?: string | number;
    max_connections?: string;
    allowed_output_formats?: string[];
  };
}

