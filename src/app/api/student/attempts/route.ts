export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { getActiveStudentAttempt, getStudentAttemptSourceCaseId, startStudentAttempt, type PublicAttemptCase } from "@/lib/student/attempt-store";
import { JsonStoreReadError } from "@/lib/admin/json-store";
import { getRequestId, logger } from "@/lib/logger";
import { hasRadiologyTest, RADIOLOGY_TEST_KEY, RADIOLOGY_TEST_NAME } from "@/lib/student/radiology-test";
import { hasEkgTest, EKG_TEST_KEY, EKG_TEST_NAME } from "@/lib/student/ekg-test";
import { caseIdFromVakaNo, parseVakaNo, vakaNoFromCaseId } from "@/lib/vaka-no";
import { clientRateLimitKey, rateLimitHeaders, takeRateLimit } from "@/lib/security/rate-limit";

const ATTEMPT_START_WINDOW_MS = 60 * 1000;
const ATTEMPT_START_IP_LIMIT = 20;

const GUEST_COOKIE = "tip_ai_guest_attempt";

function attemptStoreUnavailable(req: NextRequest, error: unknown) {
  logger.exception("Öğrenci oturumu deposuna erişilemedi", error, {
    requestId: getRequestId(req),
    route: "/api/student/attempts",
  });
  return NextResponse.json({ error: "Oturum geçici olarak kullanılamıyor. Lütfen tekrar deneyin." }, { status: 503 });
}

function poliklinikKeyFrom(value: string | null) {
  if (!value) return "*";
  return value === "*" || /^[a-z0-9-]{2,80}$/.test(value) ? value : null;
}

/**
 * sourceCaseId tek sefer çözülür; radyoloji/EKG varlık kontrolleri paralel yapılır.
 * (Eski akış aynı ID'yi 3 kez çözüyor ve kontrolleri sıralı çalıştırıyordu.)
 */
async function exposeTestler(
  vaka: PublicAttemptCase,
  sourceCaseId: string | null
): Promise<PublicAttemptCase> {
  const [radiolojiVar, ekgVar] = await Promise.all([
    sourceCaseId ? hasRadiologyTest(sourceCaseId) : Promise.resolve(false),
    sourceCaseId ? hasEkgTest(sourceCaseId) : Promise.resolve(false),
  ]);
  let testler = vaka.testler;
  if (radiolojiVar && !testler.some((test) => test.testKey === RADIOLOGY_TEST_KEY)) {
    testler = [...testler, { testKey: RADIOLOGY_TEST_KEY, testAdi: RADIOLOGY_TEST_NAME }];
  }
  if (ekgVar && !testler.some((test) => test.testKey === EKG_TEST_KEY)) {
    testler = [...testler, { testKey: EKG_TEST_KEY, testAdi: EKG_TEST_NAME }];
  }
  return testler === vaka.testler ? vaka : { ...vaka, testler };
}

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  const guestId = req.cookies.get(GUEST_COOKIE)?.value;
  const isGuestLookup = req.nextUrl.searchParams.get("guest") === "1";
  const poliklinikKey = poliklinikKeyFrom(req.nextUrl.searchParams.get("poliklinikKey"));

  if (!poliklinikKey) return NextResponse.json({ error: "Geçersiz poliklinik." }, { status: 400 });
  if (!session && !guestId) {
    return isGuestLookup
      ? NextResponse.json({ vaka: null })
      : NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }

  const actor = session?.username || `guest:${guestId}`;
  try {
    const vaka = await getActiveStudentAttempt(actor, poliklinikKey, session?.userId);
    if (!vaka) return NextResponse.json({ vaka: null });
    const sourceCaseId = await getStudentAttemptSourceCaseId(vaka.id, actor, session?.userId);
    const sonuc = await exposeTestler(vaka, sourceCaseId);
    return NextResponse.json({
      vaka: sonuc,
      vakaNo: sourceCaseId ? await vakaNoFromCaseId(sourceCaseId) : null,
    });
  } catch (error) {
    if (error instanceof JsonStoreReadError) return attemptStoreUnavailable(req, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const quota = await takeRateLimit({
    namespace: "student-attempt-start:ip",
    key: clientRateLimitKey(req),
    limit: ATTEMPT_START_IP_LIMIT,
    windowMs: ATTEMPT_START_WINDOW_MS,
  });
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Çok fazla vaka başlatma isteği. Lütfen kısa bir süre sonra tekrar deneyin." },
      { status: 429, headers: rateLimitHeaders(quota) }
    );
  }
  const body = await req.json().catch(() => null);
  const session = await getStudentSessionFromRequest(req);
  const guest = body?.guest === true;
  if (!session && !guest) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  // Paylaşım linkinden gelen vaka numarası: poliklinik + vaka doğrudan çözülür.
  let poliklinikKey: string | null = null;
  let caseId: string | null = null;
  if (typeof body?.vakaNo === "string" && parseVakaNo(body.vakaNo)) {
    const cozumlenen = await caseIdFromVakaNo(body.vakaNo);
    if (!cozumlenen) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
    poliklinikKey = cozumlenen.poliklinikKey;
    caseId = cozumlenen.caseId;
  } else {
    poliklinikKey = poliklinikKeyFrom(typeof body?.poliklinikKey === "string" ? body.poliklinikKey : null);
    if (!poliklinikKey) return NextResponse.json({ error: "Geçersiz poliklinik." }, { status: 400 });
    caseId = typeof body?.caseId === "string" && body.caseId ? body.caseId : null;
  }
  const hastaTipiId = typeof body?.hastaTipiId === "string" && body.hastaTipiId ? body.hastaTipiId : null;
  const guestId = req.cookies.get(GUEST_COOKIE)?.value || crypto.randomUUID();
  const actor = session?.username || `guest:${guestId}`;
  let vaka;
  let sourceCaseId: string | null = null;
  try {
    vaka = await startStudentAttempt(actor, poliklinikKey, session?.userId, hastaTipiId, caseId);
    if (vaka) {
      sourceCaseId = await getStudentAttemptSourceCaseId(vaka.id, actor, session?.userId);
      vaka = await exposeTestler(vaka, sourceCaseId);
    }
  } catch (error) {
    if (error instanceof JsonStoreReadError) return attemptStoreUnavailable(req, error);
    throw error;
  }
  if (!vaka) return NextResponse.json({ error: "Aktif vaka bulunamadı." }, { status: 404 });
  const response = NextResponse.json({ vaka, poliklinikKey, vakaNo: sourceCaseId ? await vakaNoFromCaseId(sourceCaseId) : null });
  for (const [k, v] of Object.entries(rateLimitHeaders(quota))) response.headers.set(k, v);
  if (!session) response.cookies.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
