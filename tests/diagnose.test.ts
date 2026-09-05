import assert from "node:assert/strict";
import { test } from "node:test";

import { diagnose } from "@/lib/player/diagnose";
import type { ProbeResult } from "@/lib/player/diagnose";

const denied: ProbeResult = { reachable: true, status: 403, ok: false, cors: null };

test("diagnose: sunucuda çalışırken 403 'hesap sorunu' diye okunmaz", () => {
  const hosted = diagnose("http://panel.net:8080/live/u/p/1.ts", undefined, denied, {
    hosted: true,
    mixedContent: true,
  });
  assert.match(hosted.title, /engelliyor/i);
  assert.match(hosted.detail, /veri merkezi/i);
  // Yanlış yönlendiren "hesabın süresi dolmuş" ifadesi bu bağlamda çıkmamalı
  assert.doesNotMatch(hosted.detail, /süresi dolmuş/i);
});

test("diagnose: lokalde 403 hesap/paket sorunu olarak okunur", () => {
  const local = diagnose("http://panel.net:8080/live/u/p/1.ts", undefined, denied, {
    hosted: false,
    mixedContent: false,
  });
  assert.match(local.detail, /süresi dolmuş|paketinde/i);
  assert.doesNotMatch(local.detail, /veri merkezi/i);
});

test("diagnose: 503 mesajı bağlamdan bağımsız aynı kalır", () => {
  const probe: ProbeResult = { reachable: true, status: 503, ok: false, cors: null };
  const result = diagnose("http://panel.net:8080/live/u/p/1.ts", undefined, probe, {
    hosted: true,
    mixedContent: true,
  });
  assert.match(result.title, /503/);
  assert.match(result.detail, /bağlantı limiti/i);
});
