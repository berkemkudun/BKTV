import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stream Hub — M3U Streaming Platform",
  description:
    "Kendi M3U playlistinizi modern bir streaming deneyimine dönüştürün. Platformlara ayrılmış film, dizi ve canlı TV kütüphanesi.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Stream Hub" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#06060a",
  width: "device-width",
  initialScale: 1,
  // Oynatıcı tam ekranda çentiğin altına da uzansın; güvenli alan payını biz veriyoruz.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="min-h-screen bg-ink-950 text-fg antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
