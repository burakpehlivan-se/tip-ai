export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import {
  clone,
  getCaseById,
  loadCasesStore,
  recordMutation,
} from "@/lib/admin/store";
import { AdminVaka } from "@/lib/admin/types";

function decodeId(raw: string): string {
  return decodeURIComponent(raw);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const id = decodeId(params.id);
  const vaka = getCaseById(id);
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  return NextResponse.json({ case: vaka });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const id = decodeId(params.id);
  const existing = getCaseById(id);
  if (!existing) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  try {
    const body = await req.json();
    const allowed: (keyof AdminVaka)[] = [
      "hastalikAdi",
      "seviye",
      "yasAraligi",
      "cinsiyetTercih",
      "anaSikayet",
      "ozetBilgiler",
      "semptomSablon",
      "rubric",
      "statikTestler",
      "hastaYanitlari",
      "idealYol",
      "egitimNotu",
      "poliklinikAd",
      "poliklinikIcon",
      "poliklinikAciklama",
      "poliklinikKey",
      "durum",
      "etiketler",
      "surum",
      "uzmanOnayi",
      "uzmanOnaylayan",
      "uzmanOnayTarihi",
    ];

    const patches: { path: string; caseId: string; field: string; before: unknown; after: unknown }[] = [];
    const updates: Partial<AdminVaka> = {};

    for (const key of allowed) {
      if (body[key] !== undefined) {
        patches.push({
          path: `cases.${id}.${key}`,
          caseId: id,
          field: key,
          before: clone(existing[key]),
          after: clone(body[key]),
        });
        (updates as any)[key] = body[key];
      }
    }

    if (!patches.length) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const result = recordMutation(
      session.username,
      "update_case",
      `"${existing.hastalikAdi}" vakası güncellendi (${patches.map((p) => p.field).join(", ")}).`,
      patches,
      (s) => {
        const idx = s.cases.findIndex((c) => c.id === id);
        if (idx >= 0) {
          s.cases[idx] = { ...s.cases[idx], ...updates, updatedAt: Date.now() };
        }
      }
    );

    const updated = result.store.cases.find((c) => c.id === id);
    return NextResponse.json({ ok: true, case: updated, log: result.log, backup: result.backup });
  } catch {
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const id = decodeId(params.id);
  const existing = getCaseById(id);
  if (!existing) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const result = recordMutation(
    session.username,
    "delete_case",
    `"${existing.hastalikAdi}" vakası silindi (${id}).`,
    [
      {
        path: `__case_delete__:${id}`,
        caseId: id,
        before: clone(existing),
        after: null,
      },
    ],
    (s) => {
      s.cases = s.cases.filter((c) => c.id !== id);
    }
  );

  return NextResponse.json({ ok: true, log: result.log, backup: result.backup });
}
