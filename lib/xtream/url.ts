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

/**
 * Aynı listenin denenecek adres varyantları.
 *
 * Xtream panelleri bu konuda çok tutarsız: aynı hesap için `output=m3u8`
 * 404 dönerken `output=ts` çalışabiliyor (ya da tam tersi), bazı paneller
 * `type=m3u_plus` yerine sade `type=m3u` istiyor, bazıları da `player_api.php`
 * adresini verip `get.php`'yi gizliyor. Kullanıcı hangi adresi yapıştırırsa
 * yapıştırsın listeye ulaşabilmek için sırayla hepsi denenir.
 *
 * İlk eleman her zaman kullanıcının verdiği adrestir.
 */
export function playlistUrlVariants(raw: string): string[] {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [raw];
  }

  const variants: string[] = [url.toString()];
  const push = (mutate: (candidate: URL) => void) => {
    const candidate = new URL(url.toString());
    mutate(candidate);
    const value = candidate.toString();
    if (!variants.includes(value)) variants.push(value);
  };

  const params = url.searchParams;
  const hasCredentials = params.has("username") && params.has("password");

  // player_api.php / panel_api.php → asıl liste adresi get.php'dir.
  if (/\/(player_api|panel_api)\.php$/i.test(url.pathname) && hasCredentials) {
    push((candidate) => {
      candidate.pathname = candidate.pathname.replace(/\/(player_api|panel_api)\.php$/i, "/get.php");
      candidate.searchParams.set("type", "m3u_plus");
      candidate.searchParams.set("output", "m3u8");
    });
    push((candidate) => {
      candidate.pathname = candidate.pathname.replace(/\/(player_api|panel_api)\.php$/i, "/get.php");
      candidate.searchParams.set("type", "m3u_plus");
      candidate.searchParams.set("output", "ts");
    });
    return variants.slice(0, 4);
  }

  const output = params.get("output");
  if (output === "m3u8") push((candidate) => candidate.searchParams.set("output", "ts"));
  else if (output) push((candidate) => candidate.searchParams.set("output", "m3u8"));
  else if (hasCredentials) {
    push((candidate) => candidate.searchParams.set("output", "m3u8"));
    push((candidate) => candidate.searchParams.set("output", "ts"));
  }

  // type parametresi yoksa ya da sadeyse, m3u_plus (grup/logo bilgisi taşır) denenir.
  if (hasCredentials && params.get("type") !== "m3u_plus") {
    push((candidate) => candidate.searchParams.set("type", "m3u_plus"));
  }

  return variants.slice(0, 4);
}
