import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proje kökünü sabitle — aksi halde Turbopack üst dizinlerdeki lock dosyalarını arar.
  turbopack: { root: process.cwd() },
  images: {
    // Posterler TMDB CDN'inden, kanal logoları rastgele M3U host'larından gelir.
    // Bu yüzden logo/poster gösteriminde <img> kullanıyoruz (bkz. components/ui/SmartImage.tsx).
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
  },
};

export default nextConfig;
