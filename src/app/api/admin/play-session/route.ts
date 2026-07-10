export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { getCaseById, recordPlaySession } from "@/lib/admin/store";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  try {
    const body = await req.json();
    const caseId = String(body.caseId || "");
    const vaka = getCaseById(caseId);
    if (!vaka) return NextResponse.json({ error: "Vaka yok" }, { status: 404 });

    const ps = recordPlaySession(
      {
        caseId,
        hastalikKey: vaka.hastalikKey,
        poliklinikKey: vaka.poliklinikKey,
        actor: session.username,
        mode: body.mode === "ogrenci" ? "ogrenci" : "admin-debug",
        toplamPuan: Number(body.toplamPuan) || 0,
        maxPuan: Number(body.maxPuan) || 0,
        taniDogru: !!body.taniDogru,
        atlananRedFlagler: body.atlananRedFlagler || [],
        gereksizTestler: body.gereksizTestler || [],
        eksikSorular: body.eksikSorular || [],
        eksikTestler: body.eksikTestler || [],
        anamnezCoverage: body.anamnezCoverage,
      },
      session.username
    );
    return NextResponse.json({ ok: true, session: ps });
  } catch {
    return NextResponse.json({ error: "Kayıt başarısız" }, { status: 500 });
  }
}
