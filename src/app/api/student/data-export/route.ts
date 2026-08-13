export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { findUserById, findUserByUsername, authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { buildStudentLearningExport } from "@/lib/student/progress";
import { appendLog } from "@/lib/admin/store";
import { recordAuthEvent } from "@/lib/auth/audit";
import { rateLimitHeaders, takeRateLimit } from "@/lib/security/rate-limit";

const EXPORT_LIMIT = 5;
const EXPORT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Öğrencinin kendi eğitim verisinin taşınabilir kopyası. Bu uç ham vaka
 * gövdesini, oturum tokenlarını, parola/credential verisini veya serbest
 * metin taslaklarını döndürmez; yanıt ayrıca cache'lenmez.
 */
export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const quota = await takeRateLimit({
    namespace: "student-data-export",
    key: session.userId || session.username,
    limit: EXPORT_LIMIT,
    windowMs: EXPORT_WINDOW_MS,
  }).catch(() => null);
  if (!quota) {
    return NextResponse.json({ error: "Veri dışa aktarma geçici olarak kullanılamıyor." }, { status: 503 });
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Kısa sürede çok fazla dışa aktarma istendi. Lütfen daha sonra tekrar deneyin." },
      { status: 429, headers: rateLimitHeaders(quota) }
    );
  }

  const user = session.userId
    ? (await findUserById(session.userId)) || (await findUserByUsername(session.username))
    : await findUserByUsername(session.username);
  if (!user || !user.active || user.role !== "ogrenci") {
    return NextResponse.json({ error: "Öğrenci hesabı bulunamadı." }, { status: 401 });
  }

  const payload = {
    format: "tip-ai-student-data-export/v1",
    generatedAt: new Date().toISOString(),
    profile: {
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
      createdAt: new Date(user.createdAt).toISOString(),
    },
    learning: buildStudentLearningExport(user.username),
    exclusions: [
      "passwords and password hashes",
      "session cookies and authentication tokens",
      "full case and rubric content",
      "active attempt drafts and free-text clinical reasoning",
    ],
  };

  // Audit yalnızca olay türü, kullanıcı ve zaman bilgisi tutar; export gövdesi,
  // bağlantı bilgisi veya serbest metin loglara yazılmaz.
  if (authUserStoreMode() === "postgres") {
    await recordAuthEvent({ event: "student_data_exported", username: user.username, role: user.role, actor: user.username });
  } else {
    appendLog({
      action: "student_data_exported",
      actor: user.username,
      message: "Öğrenci kişisel öğrenme verisi dışa aktarıldı.",
      patches: [],
    });
  }

  const filenameDate = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=tip-ai-kisisel-veri-${filenameDate}.json`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      ...rateLimitHeaders(quota),
    },
  });
}
