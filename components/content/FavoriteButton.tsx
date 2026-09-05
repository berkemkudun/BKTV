"use client";

import { Heart } from "lucide-react";

import { useUserStore } from "@/lib/store/userStore";
import type { ContentType } from "@/lib/types";

interface FavoriteButtonProps {
  id: string;
  title: string;
  type: ContentType;
  poster?: string;
  logo?: string;
  variant?: "icon" | "button";
  className?: string;
}

export function FavoriteButton({
  id,
  title,
  type,
  poster,
  logo,
  variant = "icon",
  className = "",
}: FavoriteButtonProps) {
  const isFavorite = useUserStore((state) => Boolean(state.favorites[id]));
  const toggleFavorite = useUserStore((state) => state.toggleFavorite);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite({ id, title, type, poster, logo });
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 sm:px-5 py-3 text-[15px] font-semibold transition-colors hover:bg-white/10 ${className}`}
      >
        <Heart className={`h-[18px] w-[18px] ${isFavorite ? "fill-accent text-accent" : ""}`} />
        {isFavorite ? "Listemde" : "Listeme Ekle"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
      className={`grid h-8 w-8 place-items-center rounded-full bg-black/60 backdrop-blur-sm transition-colors hover:bg-black/80 ${className}`}
    >
      <Heart className={`h-4 w-4 ${isFavorite ? "fill-accent text-accent" : "text-white"}`} />
    </button>
  );
}
