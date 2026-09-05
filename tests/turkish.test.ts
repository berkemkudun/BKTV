import assert from "node:assert/strict";
import { test } from "node:test";

import { categorizeChannel } from "@/lib/library/channelCategories";
import { isTurkishItem, isTurkishText, turkishFirst } from "@/lib/library/turkish";
import { detectCountry } from "@/lib/m3u/classify";
import type { ContentItem } from "@/lib/types";

function channel(partial: Partial<ContentItem>): ContentItem {
  return {
    id: partial.id ?? "id",
    playlistId: "pl",
    title: partial.title ?? "Kanal",
    type: partial.type ?? "live",
    streamUrl: "http://h/live/u/p/1.ts",
    group: partial.group ?? "",
    country: partial.country,
    providerSlug: "other",
    ...partial,
  } as ContentItem;
}

test("isTurkishText: Türkçe işaretçilerini yakalar", () => {
  assert.equal(isTurkishText("TR | ULUSAL"), true);
  assert.equal(isTurkishText("TÜRKİYE SPOR"), true);
  assert.equal(isTurkishText("Turkish Movies"), true);
  assert.equal(isTurkishText("TRT 1"), true);
  assert.equal(isTurkishText("UK | Sports"), false);
  assert.equal(isTurkishText("DE | Sport"), false);
});

test("isTurkishItem: önce country alanına bakar", () => {
  assert.equal(isTurkishItem(channel({ country: "TR", group: "Sports" })), true);
  assert.equal(isTurkishItem(channel({ country: "DE", group: "TR | SPOR" })), true);
  assert.equal(isTurkishItem(channel({ country: "US", group: "News", title: "CNN" })), false);
});

test("turkishFirst: Türkçe olanları başa alır, sırayı korur", () => {
  const items = [
    channel({ id: "a", group: "UK | News" }),
    channel({ id: "b", group: "TR | SPOR" }),
    channel({ id: "c", group: "US | News" }),
    channel({ id: "d", group: "TR | HABER" }),
  ];
  assert.deepEqual(
    turkishFirst(items, isTurkishItem).map((item) => item.id),
    ["b", "d", "a", "c"],
  );
});

test("turkishFirst: zaten sıradaysa aynı diziyi döndürür", () => {
  const items = [channel({ id: "a", group: "TR | SPOR" }), channel({ id: "b", group: "UK | News" })];
  assert.equal(turkishFirst(items, isTurkishItem), items);
});

test("categorizeChannel: jenerik grup adı kanal adını gölgelemez", () => {
  // "General" jenerik bir kova; kanal adı spor kanalıysa spor kazanmalı.
  assert.equal(categorizeChannel(channel({ group: "General", title: "beIN Sports 1" })).id, "sports");
  assert.equal(categorizeChannel(channel({ group: "General", title: "TRT 1" })).id, "national");
  // Adı da ipucu vermiyorsa jenerik kovaya düşer ("Diğer" değil)
  assert.equal(categorizeChannel(channel({ group: "Undefined", title: "Kanal 55" })).id, "entertainment");
});

test("categorizeChannel: grup adı özel kategoriye uyuyorsa o kazanır", () => {
  assert.equal(categorizeChannel(channel({ group: "TR | HABER", title: "Kanal X" })).id, "news");
  assert.equal(categorizeChannel(channel({ group: "TR | ÇOCUK", title: "Kanal Y" })).id, "kids");
});

test("detectCountry: tvg-id sonekinden ülkeyi okur", () => {
  assert.equal(detectCountry("General", "4U TV", { "tvg-id": "4UTV.tr@SD" }), "TR");
  assert.equal(detectCountry("General", "TRT 1", { "tvg-id": "TRT1.tr" }), "TR");
  assert.equal(detectCountry("News", "CNN", { "tvg-id": "CNN.us" }), "US");
  // gb → listedeki UK koduna eşlenir
  assert.equal(detectCountry("News", "BBC", { "tvg-id": "BBCNews.gb" }), "UK");
});

test("detectCountry: açık attribute ve dil bilgisi metinden önce gelir", () => {
  assert.equal(detectCountry("UK | Sports", "Kanal", { "tvg-country": "TR" }), "TR");
  assert.equal(detectCountry("General", "Kanal", { "tvg-language": "Turkish" }), "TR");
  // Attribute yoksa eski metin tahmini çalışmaya devam eder
  assert.equal(detectCountry("TR | SPOR", "Kanal"), "TR");
});
