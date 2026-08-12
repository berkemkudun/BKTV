import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSourceCandidates,
  detectStreamKind,
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

test("isUnsupportedContainer: tarayıcının açamayacağı formatları bilir", () => {
  assert.equal(isUnsupportedContainer("http://h/movie/u/p/1.mkv"), true);
  assert.equal(isUnsupportedContainer("http://h/movie/u/p/1.avi"), true);
  assert.equal(isUnsupportedContainer("http://h/movie/u/p/1.mp4"), false);
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
