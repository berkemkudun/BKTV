import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPlaylistUrl, normalizeHost } from "@/lib/xtream/url";

test("normalizeHost: farklı yazımlardan aynı kökü çıkarır", () => {
  const expected = "http://ornek.net:8080";
  assert.equal(normalizeHost("ornek.net:8080"), expected);
  assert.equal(normalizeHost("http://ornek.net:8080"), expected);
  assert.equal(normalizeHost("http://ornek.net:8080/"), expected);
  assert.equal(normalizeHost("  ornek.net:8080  "), expected);
});

test("normalizeHost: yapıştırılan tam M3U bağlantısından kökü alır", () => {
  assert.equal(
    normalizeHost("http://ornek.net:8080/get.php?username=a&password=b&type=m3u_plus&output=ts"),
    "http://ornek.net:8080",
  );
  assert.equal(
    normalizeHost("https://panel.ornek.net/player_api.php?username=a&password=b"),
    "https://panel.ornek.net",
  );
});

test("normalizeHost: portsuz ve https adresleri korur", () => {
  assert.equal(normalizeHost("https://ornek.net"), "https://ornek.net");
});

test("normalizeHost: geçersiz girdide null döner", () => {
  assert.equal(normalizeHost(""), null);
  assert.equal(normalizeHost("   "), null);
  // Nokta içermeyen bir "host" gerçek bir sunucu adresi değildir
  assert.equal(normalizeHost("localhost-yok"), null);
});

test("buildPlaylistUrl: özel karakterli kimlik bilgilerini kaçırır", () => {
  const url = buildPlaylistUrl("http://ornek.net:8080", "kul&lanıcı", "şif re", "m3u8");
  assert.ok(url.includes("username=kul%26lan"));
  assert.ok(url.includes("&type=m3u_plus&output=m3u8"));
  // Ayraçlar bozulmamalı: tek bir "&password=" olmalı
  assert.equal(url.split("&password=").length, 2);
});
