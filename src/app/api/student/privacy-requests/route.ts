export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import {
  PRIVACY_REQUEST_TYPES,
  listPrivacyRequests,
  submitPrivacyRequest,
  type PrivacyRequestType,
} from "@/lib/privacy/requests";
import { rateLimitHeaders, takeRateLimit } from "@/lib/security/rate-limit";

function requestType(value: unknown): PrivacyRequestType | null {
  return typeof value === "string" && (PRIVACY_REQUEST_TYPES as readonly string[]).includes(value)
    ? (value as PrivacyRequestType)
    : null;
}

/** Öğrenci yalnızca kendi talep geçmişini görebilir. */
export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  try {
    const requests = await listPrivacyRequests({ username: session.username, limit: 50 });
    return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Gizlilik talepleri şu anda yüklenemedi." }, { status: 503 });
  }
}

/**
 * Talep serbest metin kabul etmez; böylece klinik/kişisel bilgi yanlışlıkla
 * denetim günlüğüne girmez. Hesap silme işlemi burada gerçekleşmez.
 */
export async function POST(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const quota = await takeRateLimit({
    namespace: "student-privacy-request",
    key: session.userId || session.username,
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  }).catch(() => null);
  if (!quota) {
    return NextResponse.json({ error: "Gizlilik talebi geçici olarak kullanılamıyor." }, { status: 503 });
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Kısa sürede çok fazla talep oluşturuldu. Lütfen daha sonra tekrar deneyin." },
      { status: 429, headers: rateLimitHeaders(quota) }
    );
  }

  const body = await req.json().catch(() => null);
  const type = requestType(body?.type);
  if (!type) return NextResponse.json({ error: "Geçersiz gizlilik talebi." }, { status: 400 });

  try {
    const result = await submitPrivacyRequest({ username: session.username, type });
    return NextResponse.json(
      { request: result.request, created: result.created },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store, private" } }
    );
  } catch {
    return NextResponse.json({ error: "Gizlilik talebi kaydedilemedi." }, { status: 503 });
  }
}
