/**
 * Demo playlist.
 *
 * Gerçek bir M3U dosyasının aynısıdır ve uygulamadaki aynı parser'dan geçer —
 * yani demo mod "sahte ekran" değil, gerçek pipeline'ın kendisidir.
 * Grup adları bilinçli olarak dağınık yazılmıştır (VOD | NETFLIX 4K, nf dizi, ...)
 * ki provider normalizasyonu gerçek listelerdeki gibi test edilebilsin.
 *
 * Stream adresleri herkese açık HLS/MP4 test yayınlarıdır; oynatıcı demo modda da
 * gerçekten video oynatır.
 */

const HLS_BBB = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const HLS_APPLE = "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8";
const HLS_TEARS = "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8";
const HLS_PTS = "https://test-streams.mux.dev/pts_shift/master.m3u8";
const MP4_SINTEL = "https://media.w3.org/2010/05/sintel/trailer.mp4";

/** Film/dizi için: hem HLS hem progressive MP4 — iki oynatma yolu da denenebilsin. */
const VOD_STREAMS = [HLS_BBB, HLS_TEARS, MP4_SINTEL, HLS_APPLE, HLS_PTS];

/** Canlı kanallar için: sadece HLS (gerçek IPTV kanalları gibi). */
const LIVE_STREAMS = [HLS_BBB, HLS_APPLE, HLS_TEARS];

interface DemoEntry {
  name: string;
  group: string;
  stream?: string;
}

const MOVIES: DemoEntry[] = [
  { name: "Inception (2010)", group: "VOD | NETFLIX 4K - Bilim Kurgu" },
  { name: "Interstellar (2014)", group: "VOD | NETFLIX 4K - Bilim Kurgu" },
  { name: "The Dark Knight (2008)", group: "VOD | NETFLIX 4K - Aksiyon" },
  { name: "Pulp Fiction (1994)", group: "Movies | Netflix - Suç" },
  { name: "The Irishman (2019)", group: "Movies | Netflix - Dram" },
  { name: "Roma (2018)", group: "Movies | Netflix - Dram" },
  { name: "Extraction (2020)", group: "VOD | NETFLIX 4K - Aksiyon" },
  { name: "Don't Look Up (2021)", group: "Movies | Netflix - Komedi" },

  { name: "The Tomorrow War (2021)", group: "AMAZON PRIME VIDEO | Aksiyon" },
  { name: "Sound of Metal (2019)", group: "AMAZON PRIME VIDEO | Dram" },
  { name: "The Big Sick (2017)", group: "PRIME VOD - Komedi" },
  { name: "Air (2023)", group: "AMAZON PRIME VIDEO | Dram" },
  { name: "Saltburn (2023)", group: "PRIME VOD - Gerilim" },

  { name: "Avatar: The Way of Water (2022)", group: "Disney+ Filmler | Macera" },
  { name: "Spider-Man: No Way Home (2021)", group: "Disney Plus Movies - Aksiyon" },
  { name: "Avengers: Endgame (2019)", group: "Disney+ Filmler | Aksiyon" },
  { name: "Encanto (2021)", group: "Disney Plus Movies - Animasyon" },
  { name: "Soul (2020)", group: "Disney+ Filmler | Animasyon" },

  { name: "Dune: Part Two (2024)", group: "HBO MAX | Movies - Bilim Kurgu" },
  { name: "Oppenheimer (2023)", group: "MAX Movies - Dram" },
  { name: "The Batman (2022)", group: "HBO MAX | Movies - Aksiyon" },
  { name: "Joker (2019)", group: "MAX Movies - Dram" },
  { name: "Barbie (2023)", group: "HBO MAX | Movies - Komedi" },

  { name: "Killers of the Flower Moon (2023)", group: "Apple TV+ Movies | Dram" },
  { name: "Napoleon (2023)", group: "AppleTV Movies | Tarih" },
  { name: "Greyhound (2020)", group: "Apple TV+ Movies | Savaş" },

  { name: "Gladiator (2000)", group: "VOD | Filmler - Klasikler" },
  { name: "The Matrix (1999)", group: "VOD | Filmler - Bilim Kurgu" },
  { name: "Parasite (2019)", group: "VOD | Filmler - Dram" },
  { name: "Fast X (2023)", group: "VOD | Filmler - Aksiyon" },
  { name: "John Wick: Chapter 4 (2023)", group: "VOD | Filmler - Aksiyon" },
];

const SERIES: { title: string; group: string; seasons: number[][] }[] = [
  { title: "Stranger Things", group: "NETFLIX DİZİLER", seasons: [[1, 8], [2, 9], [3, 8], [4, 9]] },
  { title: "Breaking Bad", group: "nf dizi | Drama", seasons: [[1, 7], [2, 13], [3, 13], [4, 13], [5, 16]] },
  { title: "Wednesday", group: "NETFLIX DİZİLER", seasons: [[1, 8]] },
  { title: "The Boys", group: "Prime Video Dizi", seasons: [[1, 8], [2, 8], [3, 8], [4, 8]] },
  { title: "Fallout", group: "Prime Video Dizi", seasons: [[1, 8]] },
  { title: "The Last of Us", group: "MAX | Series", seasons: [[1, 9], [2, 7]] },
  { title: "House of the Dragon", group: "HBO MAX | Series", seasons: [[1, 10], [2, 8]] },
  { title: "The Mandalorian", group: "Disney+ Diziler", seasons: [[1, 8], [2, 8], [3, 8]] },
  { title: "Loki", group: "Disney Plus Series", seasons: [[1, 6], [2, 6]] },
  { title: "Ted Lasso", group: "Apple TV+ Series", seasons: [[1, 10], [2, 12], [3, 12]] },
  { title: "Severance", group: "Apple TV+ Series", seasons: [[1, 9], [2, 10]] },
];

const LIVE: DemoEntry[] = [
  { name: "TRT 1 HD", group: "TR | Ulusal Kanallar" },
  { name: "ATV HD", group: "TR | Ulusal Kanallar" },
  { name: "Show TV HD", group: "TR | Ulusal Kanallar" },
  { name: "Kanal D HD", group: "TR | Ulusal Kanallar" },
  { name: "Star TV HD", group: "TR | Ulusal Kanallar" },
  { name: "TV8 HD", group: "TR | Ulusal Kanallar" },
  { name: "NOW TV HD", group: "TR | Ulusal Kanallar" },
  { name: "TRT Belgesel", group: "TR | Belgesel" },
  { name: "beIN Sports 1 HD", group: "TR | SPOR" },
  { name: "beIN Sports 2 HD", group: "TR | SPOR" },
  { name: "S Sport Plus", group: "TR | SPOR" },
  { name: "Tivibu Spor 1", group: "TR | SPOR" },
  { name: "CNN Türk", group: "TR | HABER" },
  { name: "NTV", group: "TR | HABER" },
  { name: "BBC World News", group: "UK | News" },
  { name: "CNN International", group: "US | News" },
  { name: "Cartoon Network", group: "TR | ÇOCUK" },
  { name: "Nickelodeon", group: "TR | ÇOCUK" },
  { name: "TRT Çocuk", group: "TR | ÇOCUK" },
  { name: "Sky Sports Premier League", group: "UK | Sports" },
];

function pickStream(seed: number): string {
  return VOD_STREAMS[seed % VOD_STREAMS.length];
}

function pickLiveStream(seed: number): string {
  return LIVE_STREAMS[seed % LIVE_STREAMS.length];
}

/** Demo verisini gerçek bir M3U metni olarak üretir. */
export function buildDemoM3U(): string {
  const lines: string[] = ["#EXTM3U"];
  let seed = 0;

  for (const movie of MOVIES) {
    lines.push(
      `#EXTINF:-1 tvg-id="" tvg-name="${movie.name}" tvg-logo="" group-title="${movie.group}",${movie.name}`,
    );
    lines.push(movie.stream ?? pickStream(seed++));
  }

  for (const series of SERIES) {
    for (const [season, episodeCount] of series.seasons) {
      for (let episode = 1; episode <= episodeCount; episode++) {
        const label = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
        const name = `${series.title} ${label}`;
        lines.push(
          `#EXTINF:-1 tvg-id="" tvg-name="${name}" tvg-logo="" group-title="${series.group}",${name}`,
        );
        lines.push(pickStream(seed++));
      }
    }
  }

  for (const channel of LIVE) {
    lines.push(
      `#EXTINF:-1 tvg-id="${channel.name.toLowerCase().replace(/\s+/g, "")}.tr" tvg-name="${channel.name}" tvg-logo="" group-title="${channel.group}",${channel.name}`,
    );
    lines.push(channel.stream ?? pickLiveStream(seed++));
  }

  return lines.join("\n");
}

export const DEMO_PLAYLIST_ID = "demo";
