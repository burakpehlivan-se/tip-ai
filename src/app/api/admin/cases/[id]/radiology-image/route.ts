export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getRuntimeCaseById } from "@/lib/admin/runtime-case-store";
import { getDb } from "@/lib/auth/db";
import { radiologySources } from "@/lib/auth/schema";
import { resolveRadiologyImagePath } from "@/lib/student/radiology-image";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  const { id: rawId } = await params;
  const caseId = decodeURIComponent(rawId);
  if (!(await getRuntimeCaseById(caseId))) {
    return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  }

  try {
    const [source] = await getDb()
      .select({ imageIndex: radiologySources.imageIndex })
      .from(radiologySources)
      .where(eq(radiologySources.caseId, caseId))
      .limit(1);
    if (!source) return NextResponse.json({ error: "Bu vaka için görüntüleme kaydı yok." }, { status: 404 });

    const filePath = resolveRadiologyImagePath(source.imageIndex);
    if (!filePath) return NextResponse.json({ error: "Görüntü dosyası bulunamadı." }, { status: 404 });

    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    logger.warn("Radyoloji görüntüsü okunamadı", {
      requestId: getRequestId(req),
      route: "/api/admin/cases/[id]/radiology-image",
      caseId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Görüntü şu anda alınamadı." }, { status: 503 });
  }
}
