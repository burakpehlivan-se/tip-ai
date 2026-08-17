export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { radiologySources } from "@/lib/auth/schema";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { getStudentAttemptSourceCaseId } from "@/lib/student/attempt-store";
import { JsonStoreReadError } from "@/lib/admin/json-store";

const GUEST_COOKIE = "tip_ai_guest_attempt";
const ATTEMPT_ID = /^[0-9a-f-]{36}$/i;
const IMAGES_DIR = path.join(process.cwd(), "data/raw/chestxray/images_001/images");

/**
 * Sahibi doğrulanmış denemenin eşleştirilmiş göğüs röntgeni görüntüsünü döndürür.
 * Görüntü gerçek fakat kimliksizdir; ham dosya yolu istemciye açılmaz.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ATTEMPT_ID.test(id)) return NextResponse.json({ error: "Geçersiz vaka oturumu." }, { status: 400 });

  const session = await getStudentSessionFromRequest(req);
  const guestId = req.cookies.get(GUEST_COOKIE)?.value;
  const actor = session?.username || (guestId ? `guest:${guestId}` : null);
  if (!actor) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  try {
    const caseId = await getStudentAttemptSourceCaseId(id, actor, session?.userId);
    if (!caseId) return NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 });

    const [src] = await getDb()
      .select({ imageIndex: radiologySources.imageIndex })
      .from(radiologySources)
      .where(eq(radiologySources.caseId, caseId))
      .limit(1);
    if (!src) return NextResponse.json({ error: "Bu vaka için görüntüleme kaydı yok." }, { status: 404 });

    const fileName = path.basename(src.imageIndex);
    if (!fileName.endsWith(".png")) return NextResponse.json({ error: "Geçersiz görüntü kaydı." }, { status: 404 });

    const filePath = path.join(IMAGES_DIR, fileName);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Görüntü dosyası bulunamadı." }, { status: 404 });

    const buf = fs.readFileSync(filePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof JsonStoreReadError) {
      return NextResponse.json({ error: "Vaka oturumu geçici olarak kullanılamıyor." }, { status: 503 });
    }
    return NextResponse.json({ error: "Görüntü şu anda alınamadı." }, { status: 503 });
  }
}
