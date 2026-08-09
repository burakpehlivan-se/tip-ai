export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * Eski endpoint tam AdminVaka nesnesini (cevap anahtarı/rubrik dahil) döndürüyordu.
 * Deneme artık /api/student/attempts üzerinden sunucu oturumuyla çalışır.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Bu endpoint kaldırıldı. Deneme için vaka oturumu API'sini kullanın." },
    { status: 410 }
  );
}
