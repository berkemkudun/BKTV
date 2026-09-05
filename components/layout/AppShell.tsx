"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { AddPlaylistDialog } from "@/components/playlist/AddPlaylistDialog";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useUserStore } from "@/lib/store/userStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrateLibrary = useLibraryStore((state) => state.hydrate);
  const hydrateUser = useUserStore((state) => state.hydrate);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const pathname = usePathname();

  useEffect(() => {
    void hydrateUser();
    void hydrateLibrary();
  }, [hydrateLibrary, hydrateUser]);

  // Mobilde sayfa değişince menüyü kapat
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const isPlayerRoute = pathname?.startsWith("/watch");

  if (isPlayerRoute) {
    return (
      <>
        {children}
        <AddPlaylistDialog />
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <Header />
        {/* Alt gezinme mobilde sabit duruyor: içeriğin son satırı altında kalmasın. */}
        <main className="min-w-0 flex-1 pb-[calc(78px+env(safe-area-inset-bottom))] lg:pb-16">
          {children}
        </main>
      </div>
      <MobileNav />
      <AddPlaylistDialog />
    </div>
  );
}
