export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { loadAnalytics } from "@/lib/admin/store";
import { loadRuntimeCasesStore } from "@/lib/admin/runtime-case-store";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { recommendNextCase } from "@/lib/student/next-case-recommendation";

/** Öğrencinin kendi performansına göre, yalnızca yayımdaki vaka metadatasıyla öneri üretir. */
export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }

  const sessions = loadAnalytics().sessions.filter(
    (entry) => entry.mode === "ogrenci" && entry.actor.toLowerCase() === session.username.toLowerCase()
  );
  const candidates = (await loadRuntimeCasesStore()).cases
    .filter((caseItem) => (caseItem.durum || "aktif") === "aktif")
    .map((caseItem) => ({
      id: caseItem.id,
      poliklinikKey: caseItem.poliklinikKey,
      poliklinikAd: caseItem.poliklinikAd,
      poliklinikIcon: caseItem.poliklinikIcon,
      hastalikAdi: caseItem.hastalikAdi,
      seviye: caseItem.seviye,
    }));

  return NextResponse.json(
    { recommendation: recommendNextCase(sessions, candidates) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
