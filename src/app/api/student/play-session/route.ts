export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * Yerini /api/student/attempts/[id] aldı. Eski uç, istemcinin doğrudan eylem
 * listesi göndermesine izin verdiği için gerçek vaka oturumu kanıtı sağlamazdı.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Bu endpoint kaldırıldı. Vaka oturumu API'sini kullanın." },
    { status: 410 }
  );
}
