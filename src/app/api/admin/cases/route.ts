export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import {
  clone,
  listCasesGrouped,
  loadCasesStore,
  recordMutation,
} from "@/lib/admin/store";
import { AdminVaka, normalizeAdminVaka } from "@/lib/admin/types";
import { validateAdminVakaForPublication } from "@/lib/cdm/validate-report";
import { Seviye } from "@/lib/types";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  const grouped = listCasesGrouped();
  const store = loadCasesStore();
  return NextResponse.json({
    grouped,
    total: store.cases.length,
    changeCount: store.changeCount,
    updatedAt: store.updatedAt,
  });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  try {
    const body = await req.json();
    const poliklinikKey = String(body.poliklinikKey || "").trim();
    const hastalikKey = String(body.hastalikKey || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const hastalikAdi = String(body.hastalikAdi || "").trim();

    if (!poliklinikKey || !hastalikKey || !hastalikAdi) {
      return NextResponse.json(
        { error: "poliklinikKey, hastalikKey ve hastalikAdi zorunlu." },
        { status: 400 }
      );
    }

    const id = `${poliklinikKey}::${hastalikKey}`;
    const store = loadCasesStore();
    if (store.cases.some((c) => c.id === id)) {
      return NextResponse.json({ error: "Bu vaka zaten var." }, { status: 409 });
    }

    // poliklinik meta mevcut vakadan veya body'den
    const existingPoli = store.cases.find((c) => c.poliklinikKey === poliklinikKey);
    const now = Date.now();
    const vaka: AdminVaka = normalizeAdminVaka({
      id,
      poliklinikKey,
      poliklinikAd: String(body.poliklinikAd || existingPoli?.poliklinikAd || poliklinikKey),
      poliklinikIcon: String(body.poliklinikIcon || existingPoli?.poliklinikIcon || "🏥"),
      poliklinikAciklama: String(body.poliklinikAciklama || existingPoli?.poliklinikAciklama || ""),
      hastalikKey,
      hastalikAdi,
      seviye: (body.seviye as Seviye) || "orta",
      yasAraligi: body.yasAraligi || [30, 70],
      cinsiyetTercih: body.cinsiyetTercih || "herhangi",
      anaSikayet: String(body.anaSikayet || ""),
      ozetBilgiler: Array.isArray(body.ozetBilgiler) ? body.ozetBilgiler : [],
      semptomSablon: String(body.semptomSablon || hastalikAdi),
      rubric: body.rubric || {
        beklenenSorular: [],
        beklenenTestler: [],
        gereksizTestler: [],
        redFlagler: [],
        kabulEdilenTani: [hastalikAdi],
        puanlama: {
          dogru_kritik_soru: 2,
          dogru_yardimci_soru: 1,
          dogru_test: 2,
          gereksiz_test: -1,
          red_flag_atlama: -3,
          tehlikeli_eksik: -5,
          tani_dogru: 5,
          tani_yanlis: -3,
        },
      },
      statikTestler: body.statikTestler || {},
      hastaYanitlari: body.hastaYanitlari || { OZEL: "Anlamadım" },
      idealYol: Array.isArray(body.idealYol) ? body.idealYol : [],
      egitimNotu: String(body.egitimNotu || ""),
      durum: body.durum || "taslak",
      etiketler: Array.isArray(body.etiketler) ? body.etiketler : ["Poliklinik"],
      surum: 1,
      uzmanOnayi: false,
      createdAt: now,
      updatedAt: now,
    });

    if (vaka.durum === "aktif") {
      const publication = validateAdminVakaForPublication(vaka);
      if (!publication.allowed) {
        return NextResponse.json(
          {
            error: "Vaka aktif olarak oluşturulamaz. Zorunlu klinik alanları tamamlayın.",
            validation: publication.validation,
          },
          { status: 422 }
        );
      }
    }

    const result = recordMutation(
      session!.username,
      "create_case",
      `"${hastalikAdi}" vakası eklendi (${id}).`,
      [
        {
          path: `__case_create__:${id}`,
          caseId: id,
          before: null,
          after: clone(vaka),
        },
      ],
      (s) => {
        s.cases.push(vaka);
      }
    );

    return NextResponse.json({ ok: true, case: vaka, log: result.log, backup: result.backup });
  } catch (error) {
    logger.exception("Vaka oluşturulamadı", error, {
      requestId: getRequestId(req),
      route: "/api/admin/cases",
    });
    return NextResponse.json({ error: "Vaka oluşturulamadı." }, { status: 500 });
  }
}
