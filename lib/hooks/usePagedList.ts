"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Büyük listeleri sayfa sayfa gösterir.
 *
 * 10.000 kartı aynı anda DOM'a basmak yerine, sayfanın sonundaki sentinel
 * görünür alana girdikçe bir sonraki grup eklenir. Sanallaştırmadan daha basit
 * ve poster lazy-load ile birleştiğinde pratikte aynı sonucu verir.
 */
export function usePagedList<T>(items: T[], pageSize = 60) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Liste (filtre) değişince sayfalamayı render sırasında başa sar.
  const [trackedItems, setTrackedItems] = useState(items);
  if (trackedItems !== items) {
    setTrackedItems(items);
    setVisibleCount(pageSize);
  }

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    if (visibleCount >= items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(current + pageSize, items.length));
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleCount, items.length, pageSize]);

  const visible = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  return { visible, sentinelRef, hasMore: visibleCount < items.length, total: items.length };
}
