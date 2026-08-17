export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getDb } from "@/lib/auth/db";
import { clinicalCases, radiologySources } from "@/lib/auth/schema";
import { resolveRadiologyImagePath } from "@/lib/student/radiology-image";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function casePreview(value: unknown) {
  const content = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const patientProfile = content.patientProfil && typeof content.patientProfil === "object"
    ? (content.patientProfil as Record<string, unknown>)
    : {};
  const conditions = Array.isArray(content.conditions)
    ? content.conditions
      .map((item) => item && typeof item === "object" ? text((item as Record<string, unknown>).ad) : "")
      .filter(Boolean)
      .slice(0, 5)
    : [];
  return {
    hastalikAdi: text(content.hastalikAdi, "Adsız vaka"),
    hastalikKey: text(content.hastalikKey),
    poliklinikAd: text(content.poliklinikAd),
    poliklinikKey: text(content.poliklinikKey),
    seviye: text(content.seviye),
    anaSikayet: text(content.anaSikayet),
    cinsiyetTercih: text(content.cinsiyetTercih),
    yasAraligi: Array.isArray(content.yasAraligi) ? content.yasAraligi.slice(0, 2) : [],
    komorbiditeler: Array.isArray(patientProfile.komorbiditeler) ? patientProfile.komorbiditeler.slice(0, 5) : [],
    conditions,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  try {
    const rows = await getDb()
      .select({
        caseId: radiologySources.caseId,
        imageIndex: radiologySources.imageIndex,
        findingLabel: radiologySources.findingLabel,
        source: radiologySources.source,
        createdAt: radiologySources.createdAt,
        content: clinicalCases.content,
      })
      .from(radiologySources)
      .leftJoin(clinicalCases, eq(clinicalCases.caseId, radiologySources.caseId));

    const items = rows.map((row) => ({
      caseId: row.caseId,
      imageIndex: row.imageIndex,
      findingLabel: row.findingLabel,
      source: row.source,
      createdAt: row.createdAt,
      imageAvailable: Boolean(resolveRadiologyImagePath(row.imageIndex)),
      vaka: casePreview(row.content),
    }));
    const labels = items.reduce<Record<string, number>>((result, item) => {
      result[item.findingLabel] = (result[item.findingLabel] || 0) + 1;
      return result;
    }, {});
    const poliklinikler = items.reduce<Record<string, number>>((result, item) => {
      const key = item.vaka.poliklinikAd || item.vaka.poliklinikKey || "Bilinmiyor";
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        imageAvailable: items.filter((item) => item.imageAvailable).length,
        labels,
        poliklinikler,
      },
    });
  } catch {
    return NextResponse.json({ error: "Tıbbi görüntü kayıtları yüklenemedi." }, { status: 503 });
  }
}
