import { NextResponse } from "next/server";

import { tmdbConfigured } from "@/lib/tmdb/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    configured: tmdbConfigured(),
    language: process.env.TMDB_LANGUAGE ?? "tr-TR",
  });
}
