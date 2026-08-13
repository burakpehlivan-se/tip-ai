export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getReadiness } from "@/lib/health/readiness";

/** Load balancer/readiness probe için bağımlılık ve şema kontrolü. */
export async function GET() {
  const result = await getReadiness();
  return NextResponse.json(result.payload, {
    status: result.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
