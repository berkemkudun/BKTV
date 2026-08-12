import assert from "node:assert/strict";
import { test } from "node:test";

import { detectProvider } from "@/lib/config/providers";
import { buildLibraryFromEntries } from "@/lib/library/build";
import { cleanTitle, detectContentType, parseSeriesInfo } from "@/lib/m3u/classify";
import { parseM3U } from "@/lib/m3u/parser";

test("parseM3U: attribute ve başlıkları ayrıştırır", () => {
  const text = [
    "#EXTM3U",
    '#EXTINF:-1 tvg-id="inception.us" tvg-name="Inception" tvg-logo="http://x/l.png" group-title="Netflix | Movies",Inception',
    "https://example.com/stream.m3u8",
  ].join("\n");

  const entries = parseM3U(text);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].attributes["tvg-name"], "Inception");
  assert.equal(entries[0].attributes["tvg-logo"], "http://x/l.png");
  assert.equal(entries[0].group, "Netflix | Movies");
  assert.equal(entries[0].url, "https://example.com/stream.m3u8");
  assert.equal(entries[0].name, "Inception");
});

test("parseM3U: başlıkta virgül olsa da doğru böler", () => {
  const text = '#EXTINF:-1 group-title="VOD",Lock, Stock and Two Smoking Barrels\nhttp://a/b.mp4';
  const entries = parseM3U(text);
  assert.equal(entries[0].name, "Lock, Stock and Two Smoking Barrels");
});

test("parseM3U: #EXTGRP ve tırnaksız attribute'ları destekler", () => {
  const text = ["#EXTINF:-1 tvg-id=trt1.tr,TRT 1", "#EXTGRP:Ulusal", "http://a/trt1"].join("\n");
  const entries = parseM3U(text);
  assert.equal(entries[0].group, "Ulusal");
  assert.equal(entries[0].attributes["tvg-id"], "trt1.tr");
});

test("parseM3U: bozuk satırlarda çökmez", () => {
  const text = ["#EXTM3U", "#EXTINF:-1,", "", "#EXTINF", "http://a/only-url", "rastgele metin"].join("\n");
  assert.doesNotThrow(() => parseM3U(text));
});

test("detectProvider: farklı yazımları normalize eder", () => {
  assert.equal(detectProvider("VOD | NETFLIX 4K").slug, "netflix");
  assert.equal(detectProvider("Movies | netflix - Aksiyon").slug, "netflix");
  assert.equal(detectProvider("AMAZON PRIME VIDEO").slug, "prime-video");
  assert.equal(detectProvider("Disney Plus Movies").slug, "disney-plus");
  assert.equal(detectProvider("HBO MAX | Series").slug, "max");
  assert.equal(detectProvider("AppleTV Movies").slug, "apple-tv-plus");
  assert.equal(detectProvider("Bilinmeyen Grup").slug, "other");
});

test("detectProvider: kelime sınırına saygı duyar", () => {
  // "max" alias'ı "Maxim TV" ile eşleşmemeli
  assert.notEqual(detectProvider("Maxim TV").slug, "max");
});

test("parseSeriesInfo: yaygın sezon/bölüm formatlarını tanır", () => {
  assert.deepEqual(parseSeriesInfo("Breaking Bad S02E04")?.label, "S02E04");
  assert.deepEqual(parseSeriesInfo("Breaking Bad S02 E04")?.label, "S02E04");
  assert.deepEqual(parseSeriesInfo("Breaking Bad 2x04")?.label, "S02E04");
  // "24x7" / "2x2" gibi kanal isimleri bölüm sanılmamalı
  assert.equal(parseSeriesInfo("News Tamil 24x7"), null);
  assert.equal(parseSeriesInfo("2x2 TV"), null);
  assert.deepEqual(parseSeriesInfo("Breaking Bad Season 2 Episode 4")?.label, "S02E04");
  assert.deepEqual(parseSeriesInfo("Kurulus 1. Sezon 4. Bolum")?.label, "S01E04");
  assert.equal(parseSeriesInfo("Inception 2160"), null);
});

test("cleanTitle: yıl ve kalite etiketlerini temizler", () => {
  assert.deepEqual(cleanTitle("TR | Inception (2010) 4K"), { title: "Inception", year: 2010 });
  assert.deepEqual(cleanTitle("The Dark Knight [1080p] TR DUB"), {
    title: "The Dark Knight",
    year: undefined,
  });
});

test("cleanTitle: boşluksuz ülke önekini de temizler", () => {
  assert.deepEqual(cleanTitle("TR:GREY'S ANATOMY"), { title: "GREY'S ANATOMY", year: undefined });
  assert.deepEqual(cleanTitle("EN|The Office"), { title: "The Office", year: undefined });
});

test("cleanTitle: iki nokta içeren başlıkları bozmaz", () => {
  assert.deepEqual(cleanTitle("Dune: Part Two (2024)"), { title: "Dune: Part Two", year: 2024 });
  assert.deepEqual(cleanTitle("Spider-Man: No Way Home"), {
    title: "Spider-Man: No Way Home",
    year: undefined,
  });
});

test("detectContentType: grup ve URL ipuçlarını birlikte kullanır", () => {
  assert.equal(detectContentType("Netflix | Movies", "Inception", "http://a/b.mp4", -1), "movie");
  assert.equal(detectContentType("NETFLIX DİZİLER", "Wednesday S01E01", "http://a/b.mkv", -1), "series");
  assert.equal(detectContentType("TR | Ulusal", "TRT 1", "http://a/b.m3u8", -1), "live");
  assert.equal(detectContentType("TR | SPOR", "beIN Sports 1", "http://a/b.m3u8", -1), "sports");
});

test("detectContentType: haber/canlı gruplarında kanal adı dizi kalıbını geçersiz kılar", () => {
  assert.equal(detectContentType("News", "News Tamil 1x01 (576p)", "http://a/b.m3u8", -1), "news");
  assert.equal(detectContentType("TR | Ulusal", "Kanal 1x02", "http://a/b.m3u8", -1), "live");
});

test("detectContentType: VOD platformlarındaki .m3u8 içerikleri canlı sayılmaz", () => {
  // Grup adı tip belirtmiyor, URL .m3u8 ve süre -1 — yine de film olmalı.
  assert.equal(
    detectContentType("AMAZON PRIME VIDEO | Dram", "Air (2023)", "http://a/b.m3u8", -1, "prime-video"),
    "movie",
  );
  assert.equal(
    detectContentType("AMAZON PRIME VIDEO | Dram", "Air", "http://a/b.m3u8", -1, "prime-video"),
    "movie",
  );
});

test("detectContentType: Türkçe ekli grup adlarını doğru okur", () => {
  // "Filmleri" eki yüzünden çocuk kanalı sanılmamalı
  assert.equal(detectContentType("Türk Çocuk Filmleri", "Rio", "http://a/b.mp4", -1), "movie");
  assert.equal(detectContentType("Türk Dizileri", "Yalı Çapkını", "http://a/b.mp4", -1), "series");
  assert.equal(detectContentType("Spor Kanalları", "beIN 1", "http://a/b.m3u8", -1), "sports");
  assert.equal(detectContentType("Haberler", "NTV", "http://a/b.m3u8", -1), "news");
  assert.equal(detectContentType("Çocuk Kanalları", "TRT Çocuk", "http://a/b.m3u8", -1), "kids");
});

test("detectContentType: Xtream adres şeması grup adından üstündür", () => {
  // Grup adı "Movies" dese bile adres /series/ diyorsa dizidir
  assert.equal(
    detectContentType("VOD | Movies", "Kızılcık Şerbeti", "http://h:8080/series/u/p/9.mkv", -1),
    "series",
  );
  assert.equal(
    detectContentType("Bilinmeyen Grup", "Inception", "http://h:8080/movie/u/p/9.mkv", -1),
    "movie",
  );
  assert.equal(detectContentType("Bilinmeyen", "TRT 1", "http://h:8080/live/u/p/9.ts", -1), "live");
  // Canlı adreste grup "spor" diyorsa alt tip korunur
  assert.equal(detectContentType("TR | SPOR", "beIN 1", "http://h:8080/live/u/p/9.ts", -1), "sports");
});

test("buildLibraryFromEntries: S/E taşımayan /series/ kayıtlarını gruba göre toplar", () => {
  const text = [
    '#EXTINF:-1 tvg-name="Bölüm 1" group-title="TR | DİZİLER | Kızılcık Şerbeti",Bölüm 1',
    "http://h:8080/series/u/p/1.mp4",
    '#EXTINF:-1 tvg-name="Bölüm 2" group-title="TR | DİZİLER | Kızılcık Şerbeti",Bölüm 2',
    "http://h:8080/series/u/p/2.mp4",
  ].join("\n");

  const { series } = buildLibraryFromEntries(parseM3U(text), "pl1");
  assert.equal(series.length, 1);
  assert.equal(series[0].title, "Kızılcık Şerbeti");
  assert.equal(series[0].episodeCount, 2);
  assert.deepEqual(
    series[0].seasons[0].episodes.map((episode) => episode.episode),
    [1, 2],
  );
});

test("buildLibraryFromEntries: dizileri sezon/bölüme göre gruplar", () => {
  const text = [
    '#EXTINF:-1 tvg-name="Breaking Bad S01E01" group-title="NETFLIX DİZİLER",Breaking Bad S01E01',
    "http://a/1",
    '#EXTINF:-1 tvg-name="Breaking Bad S01E02" group-title="NETFLIX DİZİLER",Breaking Bad S01E02',
    "http://a/2",
    '#EXTINF:-1 tvg-name="Breaking Bad S02E01" group-title="NETFLIX DİZİLER",Breaking Bad S02E01',
    "http://a/3",
  ].join("\n");

  const { series, items } = buildLibraryFromEntries(parseM3U(text), "pl1");
  assert.equal(series.length, 1);
  assert.equal(series[0].title, "Breaking Bad");
  assert.equal(series[0].seasons.length, 2);
  assert.equal(series[0].episodeCount, 3);
  assert.equal(items.length, 3);
  assert.equal(items[0].providerSlug, "netflix");
});

test("buildLibraryFromEntries: aynı filmi tekilleştirip alternatif kaynak ekler", () => {
  const text = [
    '#EXTINF:-1 tvg-name="Inception (2010) 4K" group-title="VOD | NETFLIX",Inception (2010) 4K',
    "http://a/4k",
    '#EXTINF:-1 tvg-name="Inception (2010) HD" group-title="VOD | NETFLIX",Inception (2010) HD',
    "http://a/hd",
  ].join("\n");

  const { items } = buildLibraryFromEntries(parseM3U(text), "pl1");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Inception");
  assert.equal(items[0].year, 2010);
  assert.equal(items[0].sources?.length, 2);
});

test("buildLibraryFromEntries: canlı kanalların ülkesini tespit eder", () => {
  const text = '#EXTINF:-1 tvg-name="TRT 1 HD" group-title="TR | Ulusal Kanallar",TRT 1 HD\nhttp://a/trt';
  const { items } = buildLibraryFromEntries(parseM3U(text), "pl1");
  assert.equal(items[0].type, "live");
  assert.equal(items[0].country, "TR");
});
