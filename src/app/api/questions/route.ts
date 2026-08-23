export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getEffectiveChipHavuzu } from "@/lib/admin/questions-store";

export async function GET(req: NextRequest) {
  const poliklinikKey = req.nextUrl.searchParams.get("poliklinikKey");
  const effective = getEffectiveChipHavuzu(poliklinikKey);
  return NextResponse.json({ chips: effective, total: effective.length });
}
