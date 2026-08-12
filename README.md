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

## Vercel'e deploy

Depoyu Vercel'de **Import Project** ile bağlamak yeterli — framework otomatik algılanır, ek build ayarı gerekmez.

Tek zorunlu adım: **Project Settings → Environment Variables** altına `TMDB_API_KEY` ekleyin
(Production + Preview + Development). İsteğe bağlı: `TMDB_LANGUAGE` (varsayılan `tr-TR`), `TMDB_REGION`.

Ayarlanmış olanlar:

- `vercel.json` — fonksiyonlar `fra1` (Frankfurt) bölgesinde çalışır; Türkiye'den gecikme en düşük olur.
- `/api/playlist` ve `/api/proxy` için `maxDuration = 60` — büyük M3U listeleri varsayılan 10 sn'ye sığmaz.

Deploy sonrası bilinmesi gerekenler:

- Playlistler ve izleme geçmişi **sunucuda değil, her kullanıcının tarayıcısında** durur. Deploy edilen
  adres herkese açıksa da kimse başkasının listesini görmez; ortak bir "içerik havuzu" oluşmaz.
- Stream proxy'si HLS ile sorunsuz çalışır (her segment kısa bir istektir). Tek parça MP4 aktarımı
  60 saniyelik fonksiyon limitine takılabilir — bu durumda proxy'yi kapatıp doğrudan oynatmak gerekir.
- Proxy'den geçen her megabayt Vercel bant genişliğinden düşer; yoğun kullanımda proxy'yi kapalı tutun
  (Ayarlar → Oynatıcı → "Stream proxy'sini her zaman kullan").

## Ne yapar

- **Playlist ekleme** — M3U URL'i veya `.m3u` / `.m3u8` dosyası. İndirme sunucu üzerinden yapılır, CORS sorunu yaşanmaz.
- **Otomatik analiz** — `group-title` / `tvg-*` alanlarından platform (Netflix, Prime Video, Disney+, Max,
  Apple TV+, Spor, Canlı TV…), içerik tipi (film / dizi / canlı / spor / haber / çocuk), sezon-bölüm
  (`S01E02`, `1x02`, `Sezon 1 Bölüm 2`…), ülke ve kalite bilgisi çıkarılır.
- **Platform odaklı gezinme** — ana ekranda binlerce satır yerine önce platformlar; `/provider/netflix`
  gibi sayfalarda o platformun içerikleri raflar halinde.
- **Film / dizi detayı** — TMDB posteri, backdrop, puan, süre, tür, oyuncular; dizilerde sezon-bölüm listesi.
- **Oynatıcı** — üç motor: HLS (hls.js), ham MPEG-TS (mpegts.js — IPTV panellerinin `.ts` kanalları
  tarayıcıda başka türlü açılmaz) ve progressive MP4. Bir kaynak açılmazsa sırayla `.m3u8` varyantı,
  doğrudan bağlantı ve proxy denenir. Kalite seçimi, klavye kısayolları (boşluk, ←/→, ↑/↓, M, F),
  kaldığı yerden devam, sonraki bölüme otomatik geçiş.
- **Altyazı ve ses dili** — yayında gömülü altyazı/ses parçaları varsa (HLS) oynatıcı menüsünden seçilir;
  yoksa kendi `.srt` / `.vtt` dosyanı yükleyebilirsin (SRT otomatik VTT'ye çevrilir).
- **Canlı TV** — kanallar **Spor, Ulusal, Haber, Çocuk, Belgesel, Sinema, Müzik** kategorilerine ayrılır;
  kategori içinde sağlayıcının kendi grupları alt filtre olarak kalır, seçilen kanal yandaki panelde açılır.
- **Favoriler, izleme geçmişi, global arama, ayarlar** — hepsi cihazda saklanır.
- **Birden fazla playlist** — içerikler tek kütüphanede birleşir; aynı içerik birden fazla listede varsa
  tekilleştirilip "alternatif kaynak" olarak sunulur.

## Bir yayın açılmıyorsa

Oynatıcı hata verdiğinde tahmin yürütmez: adresi sunucudan yoklar (`/api/probe`) ve tarayıcının kendi
hata mesajıyla birleştirip **somut sebebi** yazar. Karşılaşabileceklerin:

| Tanı | Anlamı | Ne yapmalı |
|---|---|---|
| **Sağlayıcı bu yayını vermiyor (503)** | Kanal sağlayıcıda kapalı, paketinde yok ya da eşzamanlı bağlantı limitin dolu | Başka kanal dene; diğer cihazlardaki yayınları kapat |
| **Erişim reddedildi (401/403)** | Hesap süresi dolmuş veya şifre değişmiş | Sağlayıcıyla görüş |
| **Tarayıcı bu kodeki açamıyor** | Dosya geliyor ama H.265/HEVC veya AC3/DTS içeriyor | Edge dene; ya da "Bağlantıyı kopyala" ile VLC'de aç |
| **Bu format tarayıcıda açılmaz** | AVI/FLV/WMV | VLC gerekir |
| **Kaynak tarayıcı isteğini engelliyor** | Sağlayıcı CORS izni göndermiyor | "Proxy ile dene" butonu |

**Eşzamanlı bağlantı limiti önemlidir.** IPTV hesaplarının çoğu aynı anda 1-2 yayına izin verir. Bu yüzden
Canlı TV sayfası kanalları **otomatik başlatmaz** — boşa açılan bir yayın, gerçekten izlemek istediğin
kanala 503 döndürebiliyor.

## Bilinen sınırlar

- **`.mkv` / `.avi` içerikler tarayıcıda açılmaz.** Hiçbir kütüphane bu konteynerleri çözemez; oynatıcı
  bunu tespit edip "VLC gibi bir oynatıcıda izle" diyor. IPTV panellerindeki filmlerin bir kısmı bu formatta.
- **Altyazı, dosyanın içindeyse okunamaz.** MP4/MKV içine gömülü altyazıları tarayıcı göstermez;
  yalnızca HLS yayınındaki altyazı parçaları ya da senin yüklediğin `.srt`/`.vtt` çalışır.
- **Ses dili değiştirme sadece HLS'te** mümkün (yayın birden fazla ses parçası sunuyorsa). MP4'te
  Chrome ses parçalarını API'ye açmaz.
- **Vercel'de playlist indirme çalışmayabilir.** IPTV panelleri veri merkezi IP'lerini sık sık engeller
  (HTTP 403). Uygulama bu durumda listeyi senin tarayıcından çekmeyi dener; o da engellenirse
  M3U dosyasını indirip "Dosya Yükle" ile ekleyebilirsin — bu yol her zaman çalışır.
  Yayınların kendisi senin IP'nden gittiği için bu kısıt oynatmayı etkilemez.
- Kimlik doğrulama / hesap sistemi yoktur; veriler tarayıcıda (IndexedDB + localStorage) tutulur.
- EPG (yayın akışı) desteği yoktur; `tvg-id` saklanır ama kullanılmaz.
- Açık tema yoktur.

## TMDB olmadan

TMDB tamamen opsiyoneldir ve anahtar yoksa uygulama hiç TMDB isteği atmaz, uyarı da göstermez.
Posterler için sırayla: TMDB (varsa) → M3U'nun kendi `tvg-logo` görseli → başlıktan üretilen renkli kapak.
Çoğu IPTV sağlayıcısı zaten poster gönderdiği için arayüz anahtarsız da dolu görünür.

## Teknoloji

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · zustand · hls.js · IndexedDB · TMDB API

Mimari ve geliştirme notları için `CLAUDE.md` dosyasına bakın.
