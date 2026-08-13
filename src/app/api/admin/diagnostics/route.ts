export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { appendLog } from "@/lib/admin/store";
import { requirePermission } from "@/lib/admin/permissions";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { getAdminDiagnostics } from "@/lib/health/diagnostics";

/**
 * Admin-only operasyon anlık görüntüsü. Endpoint salt-okunurdur; erişim
 * olayı denetim kaydına yazılır fakat sır veya kullanıcı verisi döndürmez.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "system.migrate");
  if (denied) return denied;

  const diagnostics = await getAdminDiagnostics();
  try {
    if (authUserStoreMode() === "postgres") {
      await recordAuthEvent({
        event: "admin_diagnostics_viewed",
        username: session!.username,
        role: session!.role,
        actor: session!.username,
        meta: { readiness: diagnostics.readiness.status },
      });
    } else {
      appendLog({
        action: "admin_diagnostics_viewed",
        actor: session!.username,
        message: "Yönetici operasyon tanı özeti görüntülendi.",
        patches: [],
        metadata: { readiness: diagnostics.readiness.status },
      });
    }
  } catch {
    // Tanı ekranı salt-okunur kalır; eski JSON denetim deposundaki geçici bir
    // hata, adminin canlılık ve migration durumunu görmesini engellemez.
  }

  return NextResponse.json(diagnostics, {
    headers: { "Cache-Control": "no-store, private" },
  });
}
