export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getDb } from "@/lib/auth/db";
import { clinicalCases, ekgSources } from "@/lib/auth/schema";
import { resolveEkgImagePath } from "@/lib/student/ekg-image";
import type { AdminVaka } from "@/lib/admin/types";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function casePreview(vaka: AdminVaka | undefined) {
  const conditions = Array.isArray(vaka?.conditions)
    ? vaka.conditions.map((item) => text(item?.ad)).filter(Boolean).slice(0, 5)
    : [];
  return {
    hastalikAdi: text(vaka?.hastalikAdi, "Adsız vaka"),
    hastalikKey: text(vaka?.hastalikKey),
    poliklinikAd: text(vaka?.poliklinikAd),
    poliklinikKey: text(vaka?.poliklinikKey),
    seviye: text(vaka?.seviye),
    anaSikayet: text(vaka?.anaSikayet),
    cinsiyetTercih: text(vaka?.cinsiyetTercih),
    yasAraligi: vaka?.yasAraligi ? vaka.yasAraligi.slice(0, 2) : [],
    komorbiditeler: vaka?.patientProfil?.komorbiditeler?.slice(0, 5) ?? [],
    conditions,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  try {
    // N+1 yerine tek LEFT JOIN: satır başına getRuntimeCaseById çağrısı
    // (sayfa yüklemesi başına yüzlerce sorgu) kaldırıldı; eşleşmeyen caseId'ler
    // için vaka preview alanları boş kalır — davranış aynı.
    const rows = await getDb()
      .select({
        caseId: ekgSources.caseId,
        ecgId: ekgSources.ecgId,
        imageIndex: ekgSources.imageIndex,
        scpCodes: ekgSources.scpCodes,
        findingLabel: ekgSources.findingLabel,
        source: ekgSources.source,
        createdAt: ekgSources.createdAt,
        vakaContent: clinicalCases.content,
      })
      .from(ekgSources)
      .leftJoin(clinicalCases, eq(ekgSources.caseId, clinicalCases.caseId));

    const items = rows.map((row) => {
      const vaka = row.vakaContent ? (row.vakaContent as AdminVaka) : undefined;
      return {
        caseId: row.caseId,
        ecgId: row.ecgId,
        imageIndex: row.imageIndex,
        scpCodes: row.scpCodes,
        findingLabel: row.findingLabel,
        source: row.source,
        createdAt: row.createdAt,
        imageAvailable: Boolean(resolveEkgImagePath(row.imageIndex)),
        vaka: casePreview(vaka),
      };
    });

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
    return NextResponse.json({ error: "EKG kayıtları yüklenemedi." }, { status: 503 });
  }
}