"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { hash } from "@/lib/utils/id";

/** Tür/kategori kutucukları — başlıktan türetilen sabit renklerle. */
const PALETTE = [
  ["#7C3AED", "#2E1065"],
  ["#DC2626", "#450A0A"],
  ["#0EA5E9", "#082F49"],
  ["#F59E0B", "#451A03"],
  ["#16A34A", "#052E16"],
  ["#EC4899", "#500724"],
  ["#6366F1", "#1E1B4B"],
  ["#14B8A6", "#042F2E"],
];

export function categoryColors(name: string): [string, string] {
  const index = Number.parseInt(hash(name), 36) % PALETTE.length;
  return PALETTE[index] as [string, string];
}

export interface CategoryTile {
  name: string;
  count: number;
  href: string;
}

export function CategoryTiles({ title, tiles }: { title: string; tiles: CategoryTile[] }) {
  if (tiles.length === 0) return null;

  return (
    <section className="px-5 pt-8 lg:px-8">
      <h2 className="mb-4 text-[19px] font-bold tracking-tight lg:text-[21px]">{title}</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {tiles.map((tile) => {
          const [from, to] = categoryColors(tile.name);
          return (
            <Link
              key={tile.name}
              href={tile.href}
              className="group relative flex h-[86px] flex-col justify-between overflow-hidden rounded-2xl border border-white/8 p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
              style={{ background: `linear-gradient(135deg, ${from}55 0%, ${to} 70%)` }}
            >
              <span
                className="absolute -right-6 -top-8 h-20 w-20 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
                style={{ background: from }}
              />
              <span className="relative truncate text-[15px] font-bold">{tile.name}</span>
              <span className="relative flex items-center justify-between text-[12px] text-fg-muted">
                {tile.count.toLocaleString("tr-TR")} içerik
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
