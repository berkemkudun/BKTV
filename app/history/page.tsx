"use client";

import { Trash2 } from "lucide-react";

import { ProgressCard } from "@/components/content/ProgressCard";
import { EmptyState } from "@/components/ui/States";
import { useContinueWatching, useUserStore } from "@/lib/store/userStore";

export default function HistoryPage() {
  const history = useContinueWatching(200);
  const clearHistory = useUserStore((state) => state.clearHistory);

  if (history.length === 0) {
    return (
      <EmptyState
        title="İzleme geçmişin boş"
        message="Bir içeriği izlemeye başladığında kaldığın yer burada tutulur ve ana sayfada 'Devam Et' rafında görünür."
        actionLabel="İçerikleri keşfet"
        actionHref="/"
      />
    );
  }

  return (
    <div className="px-4 sm:px-5 pb-12 pt-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-[14px] text-fg-muted">{history.length} içerik</p>
        <button
          type="button"
          onClick={clearHistory}
          className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3.5 py-2 text-[13.5px] font-medium text-fg-muted transition-colors hover:border-accent/30 hover:text-accent"
        >
          <Trash2 className="h-4 w-4" /> Geçmişi temizle
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 sm:gap-5">
        {history.map((progress) => (
          <ProgressCard key={progress.contentId} progress={progress} fill />
        ))}
      </div>
    </div>
  );
}
