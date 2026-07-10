export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import {
  clone,
  getCaseById,
  recordMutation,
} from "@/lib/admin/store";
import { TestSonucu } from "@/lib/types";

function decodeId(raw: string): string {
  return decodeURIComponent(raw);
}

function formatVal(v: unknown): string {
  if (v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** POST: test ekle veya güncelle (tam TestSonucu) */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const caseId = decodeId(params.id);
  const vaka = getCaseById(caseId);
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  try {
    const body = await req.json();
    const testKey = String(body.testKey || "").trim().toUpperCase();
    if (!testKey) {
      return NextResponse.json({ error: "testKey zorunlu." }, { status: 400 });
    }

    const test: TestSonucu = {
      testKey,
      testAdi: String(body.testAdi || testKey),
      tip: body.tip || "text",
      sonuc: body.sonuc !== undefined ? body.sonuc : "Normal.",
      referans: body.referans,
      yorum: body.yorum,
      source: body.source || "original",
    };

    const before = vaka.statikTestler[testKey] ? clone(vaka.statikTestler[testKey]) : null;
    const isNew = !before;
    const action = isNew ? "add_test" : "update_test";
    const message = isNew
      ? `"${vaka.hastalikAdi}" vakasına "${test.testAdi}" (${testKey}) testi eklendi.`
      : `"${vaka.hastalikAdi}" vakasının "${test.testAdi}" (${testKey}) testi güncellendi.`;

    const result = recordMutation(
      session.username,
      action,
      message,
      [
        {
          path: `cases.${caseId}.statikTestler.${testKey}`,
          caseId,
          testKey,
          before,
          after: clone(test),
        },
      ],
      (s) => {
        const idx = s.cases.findIndex((c) => c.id === caseId);
        if (idx >= 0) {
          s.cases[idx].statikTestler[testKey] = test;
          s.cases[idx].updatedAt = Date.now();
        }
      }
    );

    return NextResponse.json({
      ok: true,
      test,
      log: result.log,
      backup: result.backup,
    });
  } catch {
    return NextResponse.json({ error: "Test kaydedilemedi." }, { status: 500 });
  }
}

/** PATCH: tek alan güncelle (sonuc.deger, yorum, vb.) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const caseId = decodeId(params.id);
  const vaka = getCaseById(caseId);
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  try {
    const body = await req.json();
    const testKey = String(body.testKey || "").trim().toUpperCase();
    const field = String(body.field || "").trim(); // "sonuc" | "sonuc.deger" | "yorum" | "testAdi" | ...
    if (!testKey || !field) {
      return NextResponse.json({ error: "testKey ve field zorunlu." }, { status: 400 });
    }
    if (!vaka.statikTestler[testKey]) {
      return NextResponse.json({ error: "Test bulunamadı." }, { status: 404 });
    }

    const pathStr = `cases.${caseId}.statikTestler.${testKey}.${field}`;
    // before
    let before: any = vaka.statikTestler[testKey];
    const parts = field.split(".");
    for (const p of parts) {
      before = before?.[p];
    }
    const after = body.value;

    const message = `"${vaka.hastalikAdi}" vakasının "${testKey}" testinin ${field} değeri ${formatVal(before)} → ${formatVal(after)} olarak değiştirildi.`;

    const result = recordMutation(
      session.username,
      "update_test_field",
      message,
      [
        {
          path: pathStr,
          caseId,
          testKey,
          field,
          before: clone(before),
          after: clone(after),
        },
      ],
      (s) => {
        const idx = s.cases.findIndex((c) => c.id === caseId);
        if (idx < 0) return;
        let cur: any = s.cases[idx].statikTestler[testKey];
        for (let i = 0; i < parts.length - 1; i++) {
          if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
            cur[parts[i]] = {};
          }
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = after;
        s.cases[idx].updatedAt = Date.now();
      }
    );

    const updated = result.store.cases.find((c) => c.id === caseId)?.statikTestler[testKey];
    return NextResponse.json({
      ok: true,
      test: updated,
      log: result.log,
      backup: result.backup,
    });
  } catch {
    return NextResponse.json({ error: "Alan güncellenemedi." }, { status: 500 });
  }
}

/** DELETE: test sil */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const caseId = decodeId(params.id);
  const vaka = getCaseById(caseId);
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const testKey = String(req.nextUrl.searchParams.get("testKey") || "")
    .trim()
    .toUpperCase();
  if (!testKey || !vaka.statikTestler[testKey]) {
    return NextResponse.json({ error: "Test bulunamadı." }, { status: 404 });
  }

  const before = clone(vaka.statikTestler[testKey]);
  const result = recordMutation(
    session.username,
    "delete_test",
    `"${vaka.hastalikAdi}" vakasından "${before.testAdi}" (${testKey}) testi silindi.`,
    [
      {
        path: `cases.${caseId}.statikTestler.${testKey}`,
        caseId,
        testKey,
        before,
        after: null,
      },
    ],
    (s) => {
      const idx = s.cases.findIndex((c) => c.id === caseId);
      if (idx >= 0) {
        delete s.cases[idx].statikTestler[testKey];
        s.cases[idx].updatedAt = Date.now();
      }
    }
  );

  return NextResponse.json({ ok: true, log: result.log, backup: result.backup });
}
