export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { getActiveStudentAttempt, getStudentAttemptSourceCaseId, startStudentAttempt, type PublicAttemptCase } from "@/lib/student/attempt-store";
import { JsonStoreReadError } from "@/lib/admin/json-store";
import { getRequestId, logger } from "@/lib/logger";
import { hasRadiologyTest, RADIOLOGY_TEST_KEY, RADIOLOGY_TEST_NAME } from "@/lib/student/radiology-test";
import { hasEkgTest, EKG_TEST_KEY, EKG_TEST_NAME } from "@/lib/student/ekg-test";

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

async function exposeRadiologyTest(
  vaka: PublicAttemptCase | null,
  actor: string,
  studentId?: string
): Promise<PublicAttemptCase | null> {
  if (!vaka) return null;
  const caseId = await getStudentAttemptSourceCaseId(vaka.id, actor, studentId);
  if (!caseId || !(await hasRadiologyTest(caseId))) return vaka;
  if (vaka.testler.some((test) => test.testKey === RADIOLOGY_TEST_KEY)) return vaka;
  return { ...vaka, testler: [...vaka.testler, { testKey: RADIOLOGY_TEST_KEY, testAdi: RADIOLOGY_TEST_NAME }] };
}

async function exposeEkgTest(
  vaka: PublicAttemptCase | null,
  actor: string,
  studentId?: string
): Promise<PublicAttemptCase | null> {
  if (!vaka) return null;
  const caseId = await getStudentAttemptSourceCaseId(vaka.id, actor, studentId);
  if (!caseId || !(await hasEkgTest(caseId))) return vaka;
  if (vaka.testler.some((test) => test.testKey === EKG_TEST_KEY)) return vaka;
  return { ...vaka, testler: [...vaka.testler, { testKey: EKG_TEST_KEY, testAdi: EKG_TEST_NAME }] };
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
    return NextResponse.json({ vaka: await exposeEkgTest(await exposeRadiologyTest(vaka, actor, session?.userId), actor, session?.userId) });
  } catch (error) {
    if (error instanceof JsonStoreReadError) return attemptStoreUnavailable(req, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session = await getStudentSessionFromRequest(req);
  const guest = body?.guest === true;
  if (!session && !guest) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  const poliklinikKey = poliklinikKeyFrom(typeof body?.poliklinikKey === "string" ? body.poliklinikKey : null);
  if (!poliklinikKey) return NextResponse.json({ error: "Geçersiz poliklinik." }, { status: 400 });
  const hastaTipiId = typeof body?.hastaTipiId === "string" && body.hastaTipiId ? body.hastaTipiId : null;
  const guestId = req.cookies.get(GUEST_COOKIE)?.value || crypto.randomUUID();
  let vaka;
  try {
    vaka = await startStudentAttempt(session?.username || `guest:${guestId}`, poliklinikKey, session?.userId, hastaTipiId);
    vaka = await exposeEkgTest(await exposeRadiologyTest(vaka, session?.username || `guest:${guestId}`, session?.userId), session?.username || `guest:${guestId}`, session?.userId);
  } catch (error) {
    if (error instanceof JsonStoreReadError) return attemptStoreUnavailable(req, error);
    throw error;
  }
  if (!vaka) return NextResponse.json({ error: "Aktif vaka bulunamadı." }, { status: 404 });
  const response = NextResponse.json({ vaka });
  if (!session) response.cookies.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
