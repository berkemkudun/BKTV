import assert from "node:assert/strict";
import { test } from "node:test";

import type { PlaybackEnvironment } from "@/lib/player/stream";
import {
  buildSourceCandidates,
  detectStreamKind,
  isRiskyContainer,
  isUnsupportedContainer,
  toHlsVariant,
} from "@/lib/player/stream";
import { srtToVtt } from "@/lib/player/subtitles";

test("detectStreamKind: IPTV adres tiplerini ayırır", () => {
  assert.equal(detectStreamKind("http://h:8080/live/u/p/123.ts"), "mpegts");
  assert.equal(detectStreamKind("http://h:8080/live/u/p/123.m3u8"), "hls");
  assert.equal(detectStreamKind("http://h:8080/movie/u/p/123.mp4"), "progressive");
  // Uzantısız canlı adres de MPEG-TS'tir
  assert.equal(detectStreamKind("http://h:8080/live/u/p/123"), "mpegts");
  assert.equal(detectStreamKind("http://h:8080/u/p/123"), "mpegts");
});

test("toHlsVariant: .ts adresinin HLS karşılığını üretir", () => {
  assert.equal(toHlsVariant("http://h:8080/live/u/p/123.ts"), "http://h:8080/live/u/p/123.m3u8");
  assert.equal(toHlsVariant("http://h:8080/live/u/p/123"), "http://h:8080/live/u/p/123.m3u8");
  // Zaten HLS ise varyant yok
  assert.equal(toHlsVariant("http://h:8080/live/u/p/123.m3u8"), null);
});

test("buildSourceCandidates: HLS → doğrudan → proxy sırasıyla dener", () => {
  const candidates = buildSourceCandidates("http://h:8080/live/u/p/123.ts");
  assert.equal(candidates.length, 4);
  assert.equal(candidates[0].kind, "hls");
  assert.equal(candidates[0].viaProxy, false);
  assert.equal(candidates[1].viaProxy, false);
  assert.equal(candidates[2].viaProxy, true);
  assert.ok(candidates[2].url.startsWith("/api/proxy?url="));
});

test("buildSourceCandidates: proxy zorlanınca proxy'li adaylar öne alınır", () => {
  const candidates = buildSourceCandidates("http://h:8080/live/u/p/123.ts", true);
  assert.equal(candidates[0].viaProxy, true);
});

test("buildSourceCandidates: aynı adres iki kez denenmez", () => {
  const candidates = buildSourceCandidates("http://h:8080/movie/u/p/9.mp4");
  const urls = new Set(candidates.map((candidate) => candidate.url));
  assert.equal(urls.size, candidates.length);
});

test("buildSourceCandidates: https sayfada http yayın için doğrudan aday üretilmez", () => {
  // Mixed content: tarayıcı http adres için istek bile atmaz; ya proxy ya https.
  const env: PlaybackEnvironment = { insecurePage: true, mseSupported: true, nativeHls: false };
  const candidates = buildSourceCandidates("http://h:8080/live/u/p/123.ts", false, env);
  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].kind, "hls");
  assert.equal(candidates[0].viaProxy, true);
  assert.ok(
    candidates.every(
      (candidate) => candidate.viaProxy || candidate.originalUrl.startsWith("https://"),
    ),
  );
  // Proxy engellenirse son çare olarak adresin https hali denenir.
  assert.ok(candidates.some((candidate) => !candidate.viaProxy && candidate.originalUrl.startsWith("https://")));
});

test("buildSourceCandidates: MSE yoksa (iOS) sadece native HLS adayları kalır", () => {
  const env: PlaybackEnvironment = { insecurePage: false, mseSupported: false, nativeHls: true };
  const candidates = buildSourceCandidates("http://h:8080/live/u/p/123.ts", false, env);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((candidate) => candidate.kind === "hls"));
});

test("buildSourceCandidates: hiç aday kalmasa da orijinal adres denenir", () => {
  // MSE yok, native HLS yok, adres uzantısız .ts → hiçbir aday üretilemez.
  const env: PlaybackEnvironment = { insecurePage: false, mseSupported: false, nativeHls: false };
  const candidates = buildSourceCandidates("http://h:8080/live/u/p/123.ts", false, env);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].originalUrl, "http://h:8080/live/u/p/123.ts");
});

test("isUnsupportedContainer: sadece gerçekten desteklenmeyenleri işaretler", () => {
  assert.equal(isUnsupportedContainer("http://h/movie/u/p/1.avi"), true);
  assert.equal(isUnsupportedContainer("http://h/movie/u/p/1.flv"), true);
  assert.equal(isUnsupportedContainer("http://h/movie/u/p/1.mp4"), false);
  // MKV Chrome'da (H.264/AAC ise) oynuyor — "asla açılmaz" demek yanlış olurdu
  assert.equal(isUnsupportedContainer("http://h/movie/u/p/1.mkv"), false);
  assert.equal(isRiskyContainer("http://h/movie/u/p/1.mkv"), true);
});

test("srtToVtt: SubRip'i WebVTT'ye çevirir", () => {
  const srt = ["1", "00:00:01,500 --> 00:00:03,750", "Merhaba dünya", "", "2", "00:00:04,000 --> 00:00:05,000", "İkinci satır"].join("\n");

  const vtt = srtToVtt(srt);
  assert.ok(vtt.startsWith("WEBVTT"));
  assert.ok(vtt.includes("00:00:01.500 --> 00:00:03.750"));
  assert.ok(vtt.includes("Merhaba dünya"));
  // Virgüllü zaman damgası kalmamalı
  assert.equal(/\d{2}:\d{2}:\d{2},\d{3}/.test(vtt), false);
});
