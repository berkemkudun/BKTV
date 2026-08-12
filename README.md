# Stream Hub

Kendi M3U playlistinizi Netflix / Prime Video benzeri modern bir arayüze dönüştüren streaming platformu.

> Uygulama **yayın içeriği sağlamaz**. Yalnızca sizin verdiğiniz M3U kaynaklarını ayrıştırır, platformlara
> ayırır, TMDB metadata'sıyla zenginleştirir ve tarayıcıda oynatır. Playlistleriniz ve izleme geçmişiniz
> yalnızca kendi cihazınızda saklanır.

## Hızlı başlangıç

```bash
npm install
npm run dev
```

http://localhost:3000 adresini açın. Playlist eklemeden de gezebilirsiniz: uygulama **demo modda**
örnek bir kütüphane (film, dizi, canlı kanal) ve gerçekten oynayan açık test yayınlarıyla açılır.

### TMDB metadata'sı (opsiyonel ama önerilir)

```bash
cp .env.example .env.local
# .env.local içine TMDB_API_KEY=... yazıp sunucuyu yeniden başlatın
```

Anahtar https://www.themoviedb.org/settings/api adresinden alınır (v3 key ya da v4 read token).
Anahtar **tarayıcıya hiç gönderilmez**; tüm istekler `/api/tmdb/*` üzerinden sunucuda yapılır.

Anahtar yoksa uygulama çalışmaya devam eder: poster/afiş yerine başlıktan üretilen renkli kapaklar,
açıklama yerine "TMDB'de eşleştirilemedi" bilgisi gösterilir.

## Ne yapar

- **Playlist ekleme** — M3U URL'i veya `.m3u` / `.m3u8` dosyası. İndirme sunucu üzerinden yapılır, CORS sorunu yaşanmaz.
- **Otomatik analiz** — `group-title` / `tvg-*` alanlarından platform (Netflix, Prime Video, Disney+, Max,
  Apple TV+, Spor, Canlı TV…), içerik tipi (film / dizi / canlı / spor / haber / çocuk), sezon-bölüm
  (`S01E02`, `1x02`, `Sezon 1 Bölüm 2`…), ülke ve kalite bilgisi çıkarılır.
- **Platform odaklı gezinme** — ana ekranda binlerce satır yerine önce platformlar; `/provider/netflix`
  gibi sayfalarda o platformun içerikleri raflar halinde.
- **Film / dizi detayı** — TMDB posteri, backdrop, puan, süre, tür, oyuncular; dizilerde sezon-bölüm listesi.
- **Oynatıcı** — HLS (hls.js) ve progressive MP4; kalite seçimi, klavye kısayolları (boşluk, ←/→, ↑/↓, M, F),
  kaldığı yerden devam, sonraki bölüme otomatik geçiş, CORS engelli kaynaklar için proxy ile tekrar deneme.
- **Canlı TV** — gruplara/ülkelere ayrılmış kanal listesi ve yandaki panelde anlık izleme.
- **Favoriler, izleme geçmişi, global arama, ayarlar** — hepsi cihazda saklanır.
- **Birden fazla playlist** — içerikler tek kütüphanede birleşir; aynı içerik birden fazla listede varsa
  tekilleştirilip "alternatif kaynak" olarak sunulur.

## Bilinen sınırlar

- Kimlik doğrulama / hesap sistemi yoktur; veriler tarayıcıda (IndexedDB + localStorage) tutulur.
- Bazı IPTV kaynakları tarayıcıdan oynatılamaz (CORS, DRM, `mpegts` gibi tarayıcı desteklemeyen formatlar).
  Bu durumda oynatıcı hatayı açıkça gösterir ve proxy ile tekrar denemeyi önerir.
- EPG (yayın akışı) desteği yoktur; `tvg-id` saklanır ama kullanılmaz.
- Açık tema yoktur.

## Teknoloji

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · zustand · hls.js · IndexedDB · TMDB API

Mimari ve geliştirme notları için `CLAUDE.md` dosyasına bakın.
