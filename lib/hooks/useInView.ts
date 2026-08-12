"use client";

import { useCallback, useState } from "react";

/**
 * Element görünür alana girdiğinde true döner ve observer'ı bırakır.
 * Poster lazy-load ve TMDB kuyruğunu tetiklemek için kullanılır.
 *
 * Effect yerine callback ref kullanılıyor: element DOM'a girdiği anda observer
 * bağlanır, React 19'da dönen fonksiyon otomatik cleanup olarak çalışır.
 */
export function useInView<T extends Element>(rootMargin = "300px") {
  const [inView, setInView] = useState(false);

  const ref = useCallback(
    (node: T | null) => {
      if (!node) return;

      if (typeof IntersectionObserver === "undefined") {
        setInView(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin },
      );
      observer.observe(node);

      return () => observer.disconnect();
    },
    [rootMargin],
  );

  return { ref, inView };
}
