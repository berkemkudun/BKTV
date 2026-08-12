import { NextRequest, NextResponse } from "next/server";

import { TmdbError, TmdbNotConfiguredError, searchTitle } from "@/lib/tmdb/server";

export const runtime = "nodejs";

/**
 * GET /api/tmdb/search?title=Inception&year=2010&type=movie
 * Eşleşme bulunamazsa 200 + { match: null } döner — UI M3U verisiyle devam eder.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = params.get("title")?.trim();
  if (!title) return NextResponse.json({ error: "title parametresi gerekli" }, { status: 400 });

  const yearParam = params.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  const type = params.get("type") === "tv" ? "tv" : "movie";

  try {
    const match = await searchTitle(title, { year: Number.isFinite(year) ? year : undefined, type });
    return NextResponse.json(
      { match },
      { headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    if (error instanceof TmdbNotConfiguredError) {
      return NextResponse.json({ match: null, configured: false }, { status: 200 });
    }
    if (error instanceof TmdbError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "TMDB araması başarısız" }, { status: 500 });
  }
}
