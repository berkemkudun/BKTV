"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Home, Plus, Radio, Tv } from "lucide-react";

import { useUiStore } from "@/lib/store/uiStore";

const ITEMS = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/movies", label: "Filmler", icon: Film },
  { href: "/series", label: "Diziler", icon: Tv },
  { href: "/live", label: "Canlı", icon: Radio },
];

/**
 * Mobil alt gezinme çubuğu.
 *
 * Telefonda kenar çubuğunu açmadan ana bölümlere geçiş: baş parmağın ulaştığı
 * yerde duruyor, güvenli alan (iPhone home indicator) payı bırakılıyor.
 */
export function MobileNav() {
  const pathname = usePathname();
  const openPlaylistDialog = useUiStore((state) => state.openPlaylistDialog);

  return (
    <nav
      aria-label="Alt gezinme"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="flex items-stretch">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors ${
                active ? "text-accent" : "text-fg-dim"
              }`}
            >
              <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={openPlaylistDialog}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-semibold text-fg-dim transition-colors"
        >
          <Plus className="h-[21px] w-[21px]" />
          Ekle
        </button>
      </div>
    </nav>
  );
}
