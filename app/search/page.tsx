"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Suspense, useMemo } from "react";

import { ContentCard } from "@/components/content/ContentCard";
import { SmartImage } from "@/components/ui/SmartImage";
import { useTmdbMatch } from "@/lib/hooks/useTmdb";
import { searchLibrary } from "@/lib/hooks/useLibrarySelectors";
import { useLibraryStore } from "@/lib/store/libraryStore";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="px-5 pt-10 lg:px-8" />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";

  const items = useLibraryStore((state) => state.items);
  const series = useLibraryStore((state) => state.series);

  const results = useMemo(() => searchLibrary(query, items, series), [query, items, series]);
  const totalResults = results.movies.length + results.series.length + results.channels.length;

  if (!query) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-fg-dim">
          <Search className="h-6 w-6" />
        </span>
        <h2 className="text-[18px] font-semibold">Ne izlemek istiyorsun?</h2>
        <p className="max-w-md text-[14px] text-fg-muted">
          Film, dizi ya da kanal adı yaz. Arama kendi kütüphanen üzerinde çalışır.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-12 pt-6 lg:px-8">
      <p className="text-[14px] text-fg-muted">
        <span className="font-semibold text-fg">&ldquo;{query}&rdquo;</span> için{" "}
        {totalResults.toLocaleString("tr-TR")} sonuç
      </p>

      {totalResults === 0 && <TmdbFallback query={query} />}

      {results.movies.length > 0 && (
        <Section title={`Filmler (${results.movies.length})`}>
          {results.movies.map((item) => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              href={`/movie/${item.id}`}
              type="movie"
              year={item.year}
              logo={item.logo}
              fill
            />
          ))}
        </Section>
      )}

      {results.series.length > 0 && (
        <Section title={`Diziler (${results.series.length})`}>
          {results.series.map((item) => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              href={`/series/${item.id}`}
              type="series"
              year={item.year}
              logo={item.logo}
              tmdbType="tv"
              subtitle={`${item.seasons.length} Sezon`}
              fill
            />
          ))}
        </Section>
      )}

      {results.channels.length > 0 && (
        <Section title={`Canlı TV (${results.channels.length})`}>
          {results.channels.map((item) => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              href={`/watch/${item.id}`}
              type={item.type}
              logo={item.logo}
              disableTmdb
              subtitle={item.group}
              fill
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-[18px] font-bold tracking-tight">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7">{children}</div>
    </section>
  );
}

/**
 * Kütüphanede sonuç yoksa TMDB'de arayıp içeriği tanıtır.
 * Bu içerik oynatılamaz — sadece "playlistinde yok" bilgisini netleştirir.
 */
function TmdbFallback({ query }: { query: string }) {
  const { match, loading } = useTmdbMatch(query, { type: "movie" });

  if (loading) {
    return <p className="mt-8 text-[14px] text-fg-dim">TMDB&apos;de aranıyor…</p>;
  }

  if (!match) {
    return (
      <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
        <p className="text-[15px] font-semibold">Sonuç bulunamadı</p>
        <p className="mt-1.5 text-[13.5px] text-fg-muted">
          Farklı bir yazım dene ya da yeni bir playlist ekle.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col gap-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5 sm:flex-row">
      <SmartImage
        src={match.poster}
        alt={match.title}
        fallbackText={match.title}
        className="aspect-[2/3] w-[130px] shrink-0 rounded-xl"
      />
      <div className="min-w-0">
        <span className="rounded-full bg-amber-400/12 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-amber-300">
          Kütüphanende yok
        </span>
        <h3 className="mt-2.5 text-[20px] font-bold tracking-tight">{match.title}</h3>
        <p className="mt-1 text-[13px] text-fg-dim">
          {match.year} {match.rating ? `· TMDB ${match.rating.toFixed(1)}` : ""}
        </p>
        {match.overview && (
          <p className="mt-3 line-clamp-4 text-[14px] leading-relaxed text-fg-muted">{match.overview}</p>
        )}
        <p className="mt-3 text-[12.5px] text-fg-dim">
          Bu içerik TMDB&apos;de bulundu ama yüklü playlistlerinde bir stream kaynağı yok.
        </p>
      </div>
    </div>
  );
}
