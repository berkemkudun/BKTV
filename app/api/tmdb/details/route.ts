import { NextRequest, NextResponse } from "next/server";

import { TmdbError, TmdbNotConfiguredError, getDetails } from "@/lib/tmdb/server";

export const runtime = "nodejs";

/** GET /api/tmdb/details?id=27205&type=movie */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = Number(params.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Geçerli bir id gerekli" }, { status: 400 });
  }
  const type = params.get("type") === "tv" ? "tv" : "movie";

  try {
    const meta = await getDetails(id, type);
    return NextResponse.json(
      { meta },
      { headers: { "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    if (error instanceof TmdbNotConfiguredError) {
      return NextResponse.json({ meta: null, configured: false }, { status: 200 });
    }
    if (error instanceof TmdbError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "TMDB detayları alınamadı" }, { status: 500 });
  }
}
