# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje

**Stream Hub** — kullanıcının kendi M3U playlistini Netflix benzeri bir arayüze dönüştüren Next.js uygulaması.
Uygulama yayın içeriği sağlamaz; sadece kullanıcının verdiği M3U kaynaklarını ayrıştırır, platformlara ayırır,
TMDB ile zenginleştirir ve oynatır.

Ürün gereksinimlerinin tamamı `Prompt.txt` dosyasındadır; `iptv1.jpg`, `iptv2.png`, `iptv3.png` tasarım
referanslarıdır (arayüz dili Türkçe, koyu tema, kırmızı accent). Yeni özellik eklerken bu dosyaya bakın.

## Komutlar

```bash
npm run dev        # geliştirme sunucusu (Turbopack, http://localhost:3000)
npm run build      # production build + TypeScript kontrolü
npm run typecheck  # sadece tsc --noEmit
npm run lint       # eslint (react-hooks v7 kuralları aktif — set-state-in-effect hata seviyesinde)
npm test           # node:test ile parser/sınıflandırma testleri
```

Tek bir testi çalıştırmak için:

```bash
node --import ./tests/register.mjs --test --test-name-pattern "parseSeriesInfo" tests/m3u.test.ts
```

`tests/register.mjs` + `tests/alias-loader.mjs`, Node'un test runner'ına `@/...` path alias'ını çözdürür;
yeni test dosyaları da `tests/*.test.ts` deseninde olmalı.

## Ortam değişkenleri

`.env.local` (bkz. `.env.example`):

- `TMDB_API_KEY` — v3 key ya da v4 read token (`ey...` ile başlıyorsa Bearer olarak gönderilir).
  **Sadece sunucuda okunur**; `lib/tmdb/server.ts` `server-only` import eder, client tarafı `/api/tmdb/*` ile konuşur.
- Anahtar yoksa uygulama çalışmaya devam eder: posterler yerine başlıktan üretilen kapaklar gösterilir,
  `/api/tmdb/*` `{ configured: false }` döner ve arayüzde uyarı çıkar.

## Mimari

### Veri akışı (tek yön)

```
M3U URL/dosya
  → /api/playlist (sunucu proxy, CORS'u aşar)
  → lib/m3u/parser.ts        (ham #EXTINF kayıtları)
  → lib/library/build.ts     (provider + tip tespiti, dizi gruplama, tekilleştirme)
  → lib/storage/repository.ts (IndexedDB'ye yazılır)
  → lib/store/libraryStore.ts (zustand, türetilmiş Library state)
  → sayfalar/bileşenler
```

TMDB bu akışın dışındadır: içerik kartı **görünür alana girdiğinde** `lib/tmdb/client.ts` üzerinden
tek tek sorgulanır (eşzamanlı 4 istek, sonuçlar IndexedDB'de 14 gün cache'lenir). 10.000 içerikli bir
kütüphanede toplu TMDB eşleştirmesi yapılmaz — bu bilinçli bir tasarım kararıdır.

### Katmanlar

| Katman | Yer | Not |
|---|---|---|
| Parser | `lib/m3u/parser.ts` | Saf fonksiyon, DOM'a bağımlı değil, testleri var |
| Sınıflandırma | `lib/m3u/classify.ts` | Tip tespiti, S/E ayrıştırma, başlık temizleme, ülke tahmini |
| Provider config | `lib/config/providers.ts` | **Yeni platform eklemek için tek dokunulacak yer** (`aliases` dizisi) |
| Kütüphane derleme | `lib/library/build.ts` | RawEntry[] → ContentItem[]/SeriesItem[], playlist birleştirme |
| Kalıcılık | `lib/storage/*` | IndexedDB (playlist/içerik) + localStorage (tercihler) |
| State | `lib/store/*` | zustand: `libraryStore`, `userStore`, `uiStore` |
| TMDB | `lib/tmdb/server.ts` (sunucu) + `lib/tmdb/client.ts` (kuyruk/cache) | |
| UI | `components/*`, `app/*` | Tüm sayfalar client component (veri IndexedDB'de) |

### Storage'ı değiştirmek (ör. Supabase)

`lib/storage/repository.ts` içindeki `LibraryRepository` / `PreferencesRepository` arayüzlerini
uygulayan yeni bir sınıf yazıp dosyanın sonundaki `libraryRepository` / `preferencesRepository`
export'larını değiştirmek yeterlidir. Uygulamanın hiçbir yeri IndexedDB'yi doğrudan çağırmaz
(tek istisna: `lib/tmdb/client.ts` kendi cache'i için `STORES.tmdb` kullanır).
`lib/types.ts`'teki modeller tablo şeması olarak birebir kullanılabilir.

### API route'ları

- `POST /api/playlist` — M3U'yu sunucuda indirir (VLC user-agent, 45sn timeout, `#EXTINF` doğrulaması).
- `GET /api/proxy?url=` — stream proxy. `.m3u8` ise playlist'i indirip **içindeki tüm URL'leri yeniden yazar**
  (segmentler de proxy'den geçsin diye); değilse Range destekli byte aktarımı yapar.
  Oynatıcı, CORS kaynaklı hata alınca kullanıcıya "Proxy ile tekrar dene" seçeneği sunar.
- `GET /api/tmdb/{status,search,details}` — TMDB erişiminin tek kapısı.

## Bu kod tabanında dikkat edilecekler

- **zustand selector'ları yeni referans döndürmemeli.** `useUserStore((s) => Object.values(s.favorites))`
  gibi bir kullanım `useSyncExternalStore` ile sonsuz render döngüsü yaratır. Türetilmiş listeler için
  `useContinueWatching` / `useFavoriteList` gibi `useMemo`'lu hook'lar kullanılır.
- **`react-hooks/set-state-in-effect` hata seviyesinde.** Effect içinde senkron `setState` yerine
  "render sırasında state ayarlama" kalıbı kullanılıyor (`SmartImage`, `usePagedList`, `Header`).
- **`SmartImage`'a `absolute` sınıfı verilmez** — bileşenin kökü zaten `relative`; konumlandırma için
  sarmalayıcı div kullanılır (aksi halde Tailwind sınıf çakışması sessizce layout'u bozar).
- **Sınıflandırma sırası önemlidir** (`detectContentType`): önce grup adı (canlı/spor/haber kısa devre),
  sonra S/E kalıbı, sonra isim, sonra yıl/provider/URL ipuçları. Bu sıra "News 24x7" gibi kanalların
  dizi sanılmasını engeller; değiştirirken `tests/m3u.test.ts` çalıştırın.
- **Gerçek listeler devasadır.** 10.000+ kayıt normaldir: parse `parseM3UChunked` ile parçalanır,
  listeler `usePagedList` ile kademeli render edilir, posterler `useInView` ile lazy yüklenir.
- **Sahte özellik yok.** Çalışmayan bir şey varsa (TMDB anahtarı yok, stream ölü, kaynak CORS engelli)
  arayüz bunu açıkça söyler. Yeni özellik eklerken bu ilkeyi koruyun.
