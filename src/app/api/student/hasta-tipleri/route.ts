export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadHastaTipleriStore } from "@/lib/admin/store";

/**
 * Öğrenciye dönük hasta tipi listesi. Yalnızca gösterim alanlarını döner
 * (id, ad, aciklama); konuşma kuralları ve örnekler sunucuda kalır.
 */
export async function GET() {
  const store = loadHastaTipleriStore();
  const tipler = [...store.tipler]
    .sort((a, b) => a.ad.localeCompare(b.ad, "tr"))
    .map((t) => ({ id: t.id, ad: t.ad, aciklama: t.aciklama || "" }));
  return NextResponse.json({ tipler });
}
