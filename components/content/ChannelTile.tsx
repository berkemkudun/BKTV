"use client";

import Link from "next/link";
import { Play } from "lucide-react";

import { FavoriteButton } from "@/components/content/FavoriteButton";
import { SmartImage } from "@/components/ui/SmartImage";
import type { ContentItem } from "@/lib/types";

/** Ana sayfadaki canlı kanal rafında kullanılan 16:9 logo kartı. */
export function ChannelTile({ channel }: { channel: ContentItem }) {
  return (
    <Link
      href={`/watch/${channel.id}`}
      className="group relative w-[190px] shrink-0 focus:outline-none xl:w-[210px]"
    >
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-white/8 bg-ink-800 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-white/20">
        <SmartImage
          src={channel.logo}
          alt={channel.title}
          fallbackText={channel.title}
          className="aspect-video w-full"
          fit="contain"
        />

        <div className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30">
            <Play className="h-5 w-5 translate-x-[1px] fill-white text-white" />
          </span>
        </div>

        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <FavoriteButton id={channel.id} title={channel.title} type={channel.type} logo={channel.logo} />
        </div>
      </div>

      <p className="mt-2 truncate px-0.5 text-[13.5px] font-semibold">{channel.title}</p>
      <p className="truncate px-0.5 text-[11.5px] text-fg-dim">{channel.group}</p>
    </Link>
  );
}
