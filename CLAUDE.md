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

TMDB bu akışın dışındadır ve **tamamen opsiyoneldir**: `TMDB_API_KEY` tanımlı değilse
`lib/tmdb/client.ts` hiç istek atmaz (`tmdbStatus()` tek sefer sorulur), arayüz uyarı da göstermez —
poster olarak M3U'nun kendi `tvg-logo` görselleri ya da başlıktan üretilen kapaklar kullanılır.
Anahtar varsa: içerik kartı **görünür alana girdiğinde** tek tek sorgulanır (eşzamanlı 4 istek,
sonuçlar IndexedDB'de 14 gün cache'lenir). 10.000 içerikli bir kütüphanede toplu eşleştirme yapılmaz.

### Katmanlar

| Katman | Yer | Not |
|---|---|---|
| Parser | `lib/m3u/parser.ts` | Saf fonksiyon, DOM'a bağımlı değil, testleri var |
| Sınıflandırma | `lib/m3u/classify.ts` | Tip tespiti, S/E ayrıştırma, başlık temizleme, ülke tahmini |
| Provider config | `lib/config/providers.ts` | **Yeni platform eklemek için tek dokunulacak yer** (`aliases` dizisi) |
| Kanal kategorileri | `lib/library/channelCategories.ts` | Canlı kanalları Spor/Ulusal/Haber/Çocuk… kovalarına ayırır |
| Kütüphane derleme | `lib/library/build.ts` | RawEntry[] → ContentItem[]/SeriesItem[], playlist birleştirme, `PARSER_VERSION` |
| Oynatma motoru seçimi | `lib/player/stream.ts` | Adres → HLS/MPEG-TS/progressive + deneme sırası |
| Altyazı | `lib/player/subtitles.ts` | SRT→VTT dönüşümü, dil etiketleri |
| Kalıcılık | `lib/storage/*` | IndexedDB (playlist/içerik) + localStorage (tercihler) |
| State | `lib/store/*` | zustand: `libraryStore`, `userStore`, `uiStore` |
| TMDB | `lib/tmdb/server.ts` (sunucu) + `lib/tmdb/client.ts` (kuyruk/cache) | |
| UI | `components/*`, `app/*` | Tüm sayfalar client component (veri IndexedDB'de) |
| Kaynak ekleme formu | `components/playlist/SourceForm.tsx` | Dört giriş yolu (M3U URL / panel / dosya / demo); ana sayfa paneli ve modal aynı bileşeni kullanır |

### Storage'ı değiştirmek (ör. Supabase)

`lib/storage/repository.ts` içindeki `LibraryRepository` / `PreferencesRepository` arayüzlerini
uygulayan yeni bir sınıf yazıp dosyanın sonundaki `libraryRepository` / `preferencesRepository`
export'larını değiştirmek yeterlidir. Uygulamanın hiçbir yeri IndexedDB'yi doğrudan çağırmaz
(tek istisna: `lib/tmdb/client.ts` kendi cache'i için `STORES.tmdb` kullanır).
`lib/types.ts`'teki modeller tablo şeması olarak birebir kullanılabilir.

### API route'ları

- `POST /api/xtream` — panel girişi. `player_api.php` ile kimlik doğrular ve üç kritik bilgiyi döner:
  abonelik durumu/bitişi, `max_connections` (503'lerin baş sebebi) ve `allowed_output_formats`.
  Panel `m3u8` veriyorsa liste adresi ona göre üretilir — ham `.ts` yayınlar tarayıcıda çok daha kırılgan.
  Adres normalizasyonu `lib/xtream/url.ts`'te ve testli (kullanıcı tam M3U bağlantısını da yapıştırabiliyor).
- `POST /api/playlist` — M3U'yu sunucuda indirir (VLC user-agent, 45sn timeout, `#EXTINF` doğrulaması).
- `GET /api/probe?url=` — tanı için adresi yoklar; yalnızca başlıkları okur, gövdeyi indirmez.
- `GET /api/proxy?url=` — stream proxy. `.m3u8` ise playlist'i indirip **içindeki tüm URL'leri yeniden yazar**
  (segmentler de proxy'den geçsin diye); değilse Range destekli byte aktarımı yapar.
  Oynatıcı, CORS kaynaklı hata alınca kullanıcıya "Proxy ile tekrar dene" seçeneği sunar.
- `GET /api/tmdb/{status,search,details}` — TMDB erişiminin tek kapısı.

## Oynatma zinciri (kritik)

Gerçek IPTV panelleri (Xtream Codes) üç tip adres verir ve tarayıcı bunların yalnızca birini
doğrudan açabilir:

| Adres | Motor |
|---|---|
| `.../live/USER/PASS/1.ts` (ham MPEG-TS) | `mpegts.js` — tarayıcı native açamaz |
| `.../live/USER/PASS/1.m3u8` | `hls.js` |
| `.../movie|series/USER/PASS/1.mp4` | native `<video>` |

`buildSourceCandidates()` şu sırayla dener ve her hata sonrası otomatik bir sonrakine geçer:
**`.ts` → `.m3u8` varyantı → doğrudan → proxy'li HLS → proxy'li orijinal.** Çoğu panel aynı kanalı
`.m3u8` olarak da sunduğu için ilk aday genelde tutar.

Aday listesi ortama göre budanır (`detectEnvironment()`):

- **Sayfa https, yayın http ise (mixed content) yalnızca proxy'li adaylar üretilir.** Tarayıcı böyle
  bir yayın için istek bile atmaz; Vercel'de "hiçbir kanal açılmıyor" şikayetinin baş sebebi buydu.
- **MSE yoksa (iOS Safari) `mpegts.js` ve `hls.js` çalışamaz;** sadece native açılabilen `.m3u8`
  adayları kalır.

Hata durumunda `lib/player/diagnose.ts` devreye girer: `/api/probe` adresi sunucudan yoklar
(sadece başlıklar, gövde indirilmez) ve tarayıcının `MediaError.message`'ıyla birleştirip somut bir
sebep üretir — "503 sağlayıcı kapalı" ile "kodek desteklenmiyor" birbirinden ayrılır.
Genel "bilinmeyen hata" mesajı yazmayın; kullanıcı ne yapacağını bilmeli.

Oynatıcıda ayrıca:
- **Bekçi (watchdog):** aday 15 saniyede ilk kareyi veremezse (bağlantı açık ama veri gelmiyor)
  otomatik olarak sıradakine geçilir. Bu olmadan ekran sonsuz spinner'da kalıyordu.
- **Sesli otomatik oynatma reddedilirse yayın sessize alınıp tekrar denenir** ve kullanıcıya
  "ses kapalı başladı" düğmesi gösterilir. `play()` reddi artık "yayın açılmadı" sayılmıyor.
- **`failed` ayrı bir state değil:** `candidateIndex >= candidates.length` demektir. İki state'i
  senkron tutmaya çalışmak zincirin hata ekranıyla ayrışmasına yol açıyordu.

Dikkat:
- **`mpegts.js` `enableWorker: false` ile kullanılmalı.** Worker kodu Blob olarak üretiliyor ve
  bundler'ın modül referansları worker içinde çözülemiyor ("… is not a constructor").
- **`video.load()` boş `src` ile "error" olayı fırlatır.** `tearingDown` ref'i olmadan bu, gerçek
  yayın hatası sanılıp aday zincirini boşuna ilerletir (kaynak çalışırken bile).
- **`.mkv` "açılmaz" değildir.** Chrome, içinde H.264/AAC olan Matroska dosyalarını oynatıyor
  (gerçek listeyle test edildi). `isUnsupportedContainer()` yalnızca AVI/FLV/WMV gibi gerçekten
  desteklenmeyenleri işaretler; MKV `isRiskyContainer()` altında "kodek riski" olarak geçer.
- **IPTV hesaplarının eşzamanlı bağlantı limiti vardır (1-2).** Bu yüzden Canlı TV sayfası kanalı
  otomatik başlatmaz ve aday zinciri sıralı çalışır. Boşa açılan her yayın gerçek isteğe 503 döndürtür.

## Bu kod tabanında dikkat edilecekler

- **zustand selector'ları yeni referans döndürmemeli.** `useUserStore((s) => Object.values(s.favorites))`
  gibi bir kullanım `useSyncExternalStore` ile sonsuz render döngüsü yaratır. Türetilmiş listeler için
  `useContinueWatching` / `useFavoriteList` gibi `useMemo`'lu hook'lar kullanılır.
- **`react-hooks/set-state-in-effect` hata seviyesinde.** Effect içinde senkron `setState` yerine
  "render sırasında state ayarlama" kalıbı kullanılıyor (`SmartImage`, `usePagedList`, `Header`).
- **`SmartImage`'a `absolute` sınıfı verilmez** — bileşenin kökü zaten `relative`; konumlandırma için
  sarmalayıcı div kullanılır (aksi halde Tailwind sınıf çakışması sessizce layout'u bozar).
- **Sınıflandırma sırası önemlidir** (`detectContentType`): önce Xtream adres şeması
  (`/live/`, `/movie/`, `/series/` — en güvenilir sinyal), sonra grup adı (canlı/spor/haber kısa devre),
  sonra S/E kalıbı, sonra isim, sonra yıl/provider/URL ipuçları. Bu sıra "News 24x7" gibi kanalların
  dizi sanılmasını engeller; değiştirirken `tests/m3u.test.ts` çalıştırın.
- **Anahtar kelimeler Türkçe eklere duyarlı.** `TYPE_KEYWORDS` içinde `film*` yazmak "filmler",
  "filmleri", "filmi" varyantlarını da yakalar. Bu olmadan "Türk Çocuk Filmleri" grubu kanal sanılıyordu.
- **Sınıflandırma değişince `PARSER_VERSION`'ı artırın** (`lib/library/build.ts`). Ham M3U metni
  saklanmadığı için eski kütüphaneler otomatik güncellenemez; Ayarlar sayfası "yenile" uyarısı gösterir.
- **Gerçek listeler devasadır.** 10.000+ kayıt normaldir: parse `parseM3UChunked` ile parçalanır,
  listeler `usePagedList` ile kademeli render edilir, posterler `useInView` ile lazy yüklenir.
- **Mobil birinci sınıf vatandaş.** Alt gezinme çubuğu (`components/layout/MobileNav.tsx`) lg altında
  her sayfada duruyor, `main` bu yüzden alttan `78px + safe-area` boşluk bırakıyor. Canlı TV'de
  oynatıcı mobilde DOM'da listeden önce ve yapışkan: yüzlerce kanalın altında kalınca kullanıcı
  "kanal açılmıyor" sanıyordu. Form inputları mobilde 16px — altında iOS Safari sayfayı zoomluyor.
- **Grid item'lara `min-w-0` vermeyi unutmayın.** Otomatik minimum boyut (video elemanı, uzun grup
  adları) tek sütunlu mobil ızgarayı ekranın üç katı genişliğe taşırıyordu; `body`'de
  `overflow-x: hidden` olduğu için sorun görünmüyor, sadece içerik kırpılıyordu.
- **Sahte özellik yok.** Çalışmayan bir şey varsa (TMDB anahtarı yok, stream ölü, kaynak CORS engelli)
  arayüz bunu açıkça söyler. Yeni özellik eklerken bu ilkeyi koruyun.
