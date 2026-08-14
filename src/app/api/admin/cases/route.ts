export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import {
  clone,
  loadCasesStore,
  recordMutation,
} from "@/lib/admin/store";
import { listRuntimeCasesGrouped, loadRuntimeCasesStore } from "@/lib/admin/runtime-case-store";
import { AdminVaka, normalizeAdminVaka } from "@/lib/admin/types";
import { parseCreateCaseInput } from "@/lib/admin/case-input";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  const [grouped, store] = await Promise.all([listRuntimeCasesGrouped(), loadRuntimeCasesStore()]);
  return NextResponse.json({
    grouped,
    total: store.cases.length,
    changeCount: store.changeCount,
    updatedAt: store.updatedAt,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  try {
    const parsed = parseCreateCaseInput(await req.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Geçersiz vaka verisi.", issues: parsed.issues },
        { status: 400 }
      );
    }
    const input = parsed.value;
    const { poliklinikKey, hastalikKey, hastalikAdi } = input;

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
      poliklinikAd: input.poliklinikAd || existingPoli?.poliklinikAd || poliklinikKey,
      poliklinikIcon: input.poliklinikIcon || existingPoli?.poliklinikIcon || "🏥",
      poliklinikAciklama: input.poliklinikAciklama || existingPoli?.poliklinikAciklama || "",
      hastalikKey,
      hastalikAdi,
      seviye: input.seviye || "orta",
      yasAraligi: input.yasAraligi || [30, 70],
      cinsiyetTercih: input.cinsiyetTercih || "herhangi",
      anaSikayet: input.anaSikayet || "",
      ozetBilgiler: input.ozetBilgiler || [],
      semptomSablon: input.semptomSablon || hastalikAdi,
      rubric: input.rubric || {
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
      statikTestler: input.statikTestler || {},
      hastaYanitlari: input.hastaYanitlari || { OZEL: "Anlamadım" },
      idealYol: input.idealYol || [],
      egitimNotu: input.egitimNotu || "",
      // Yeni vaka önce taslak olur; yayın yalnızca bağımsız review endpoint'iyle yapılır.
      durum: input.durum === "arsiv" ? "arsiv" : "taslak",
      etiketler: input.etiketler || ["Poliklinik"],
      surum: 1,
      uzmanOnayi: false,
      incelemeDurumu: "taslak",
      olusturan: session!.username,
      sonDuzenleyen: session!.username,
      createdAt: now,
      updatedAt: now,
      cdmVersion: input.cdmVersion,
      patientProfil: input.patientProfil,
      vitals: input.vitals,
      conditions: input.conditions,
      tedavi: input.tedavi,
    });

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
