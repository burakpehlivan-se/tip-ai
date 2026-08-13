export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getReadiness } from "@/lib/health/readiness";

/**
 * Yeni release başlangıcının migration sonrası trafiğe hazır olduğunu doğrular.
 * Docker CMD migration başarısızsa sunucuyu başlatmadığı için bu uç yalnızca
 * süreç ayağa kalktıktan sonra readiness ile aynı güvenlik koşullarını ölçer.
 */
export async function GET() {
  const result = await getReadiness();
  return NextResponse.json(
    { ...result.payload, startup: result.ready ? "complete" : "pending" },
    { status: result.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
