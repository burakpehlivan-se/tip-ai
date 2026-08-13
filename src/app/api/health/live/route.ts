export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * Liveness hiçbir veritabanı veya harici bağımlılığa dokunmaz. Süreç cevap
 * verebildiği sürece 200 döner; yeniden başlatma kararında kullanılır.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
