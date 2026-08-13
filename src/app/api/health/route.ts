export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { checkAuthMigrationReadiness } from "@/lib/auth/migration-readiness";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";

/**
 * Liveness + PostgreSQL auth/öğrenme şeması readyz kontrolü. Yanıt yalnızca
 * durum işaretleri içerir; sır, kullanıcı, hata ayrıntısı veya bağlantı bilgisi
 * içermez. Docker healthcheck bu uçtan 200 bekler; eksik migration'da yeni
 * container trafik almadan unhealthy kalır.
 */
export async function GET() {
  try {
    const store = authUserStoreMode();
    if (store === "json") {
      return NextResponse.json(
        { status: "ok", auth: { store, migration: "not_required" } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const readiness = await checkAuthMigrationReadiness();
    return NextResponse.json(
      {
        status: readiness.ok ? "ok" : "not_ready",
        auth: { store, migration: readiness.checks },
      },
      {
        status: readiness.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready", auth: { store: "invalid", migration: "not_checked" } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
