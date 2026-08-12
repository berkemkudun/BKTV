/**
 * Xtream panel adresi yardımcıları.
 *
 * Kullanıcılar sunucu adresini çok farklı biçimlerde giriyor:
 *   "germanyservers3.net:8080", "http://germanyservers3.net:8080/",
 *   hatta doğrudan tam M3U bağlantısını yapıştırıyorlar.
 * Hepsinden aynı kökü çıkarabilmek gerekiyor.
 */

/** "ornek.net:8080" → "http://ornek.net:8080" · geçersizse null */
export function normalizeHost(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  // Tam M3U/API bağlantısı yapıştırıldıysa kökü al.
  value = value.replace(/\/(get|player_api|panel_api|xmltv)\.php.*$/i, "");
  value = value.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;

  try {
    const url = new URL(value);
    if (!url.hostname || !url.hostname.includes(".")) return null;
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${url.hostname}${port}`;
  } catch {
    return null;
  }
}

/**
 * Panelin M3U adresini üretir.
 * `output=m3u8` panel destekliyorsa tercih edilir: ham .ts yayınlar tarayıcıda
 * mpegts.js gerektirir ve belirgin şekilde daha kırılgandır.
 */
export function buildPlaylistUrl(
  base: string,
  username: string,
  password: string,
  output: "m3u8" | "ts",
): string {
  return (
    `${base}/get.php?username=${encodeURIComponent(username)}` +
    `&password=${encodeURIComponent(password)}&type=m3u_plus&output=${output}`
  );
}
