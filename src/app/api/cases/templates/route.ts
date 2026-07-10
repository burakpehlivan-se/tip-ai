export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadCasesStore } from "@/lib/admin/store";

/**
 * Public (öğrenci tarafı) — admin deposundaki vaka test şablonlarını okur.
 * Auth gerekmez; sadece eğitim şablonları.
 */
export async function GET() {
  try {
    const store = loadCasesStore();
    // Öğrenciye yalnızca aktif + (isteğe bağlı) onaylı taslak olmayan vakalar
    const templates = store.cases
      .filter((c) => (c.durum || "aktif") === "aktif")
      .map((c) => ({
      id: c.id,
      poliklinikKey: c.poliklinikKey,
      poliklinikAd: c.poliklinikAd,
      poliklinikIcon: c.poliklinikIcon,
      hastalikKey: c.hastalikKey,
      hastalikAdi: c.hastalikAdi,
      seviye: c.seviye,
      yasAraligi: c.yasAraligi,
      cinsiyetTercih: c.cinsiyetTercih,
      anaSikayet: c.anaSikayet,
      ozetBilgiler: c.ozetBilgiler,
      rubric: c.rubric,
      statikTestler: c.statikTestler,
      hastaYanitlari: c.hastaYanitlari,
      idealYol: c.idealYol,
      egitimNotu: c.egitimNotu,
      etiketler: c.etiketler || [],
      durum: c.durum || "aktif",
      updatedAt: c.updatedAt,
    }));
    return NextResponse.json({
      templates,
      updatedAt: store.updatedAt,
      total: templates.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Şablonlar yüklenemedi", templates: [] }, { status: 500 });
  }
}
