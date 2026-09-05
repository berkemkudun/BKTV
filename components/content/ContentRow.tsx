"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ContentRowProps {
  title: string;
  href?: string;
  children: React.ReactNode;
  /** Sağ üstte gösterilecek küçük bilgi ("128 içerik") */
  meta?: string;
}

/**
 * Yatay içerik rafı.
 * Klavye/kumanda ile gezilebilir; ok tuşları sadece kaydırılabilir alan varsa görünür.
 */
export function ContentRow({ title, href, children, meta }: ContentRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 8);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const element = scrollerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateArrows, children]);

  const scrollBy = (direction: 1 | -1) => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.round(element.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className="group/row relative py-4">
      <div className="mb-3 flex items-baseline justify-between gap-4 px-4 sm:px-5 lg:px-8">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[17px] font-bold tracking-tight sm:text-[19px] lg:text-[21px]">{title}</h2>
          {meta && <span className="text-[12.5px] text-fg-dim">{meta}</span>}
        </div>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            Tümünü Gör <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Geri kaydır"
            className="absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/90 group-hover/row:opacity-100 lg:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="İleri kaydır"
            className="absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/90 group-hover/row:opacity-100 lg:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollerRef}
          onScroll={updateArrows}
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:gap-4 sm:px-5 lg:px-8"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
