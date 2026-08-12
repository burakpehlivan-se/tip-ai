export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import {
  loadRuleEngineStore,
  saveRuleEngineStore,
  addRule,
  updateRule,
  deleteRule,
  addAlias,
  deleteAlias,
  resetToDefaults,
} from "@/lib/admin/rule-engine-store";
import { RuleEntry, DiseaseAlias } from "@/lib/admin/rule-engine-types";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "system.migrate");
  if (denied) return denied;

  const store = loadRuleEngineStore();
  return NextResponse.json(store);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const denied = requirePermission(session, "system.migrate");
  if (denied) return denied;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "add-rule": {
        const rule = addRule({
          testKey: body.testKey,
          diseaseKey: body.diseaseKey,
          tendency: body.tendency,
          factor: Number(body.factor),
          description: body.description || "",
          active: body.active !== false,
        });
        return NextResponse.json({ ok: true, rule });
      }

      case "update-rule": {
        const rule = updateRule(body.id, {
          tendency: body.tendency,
          factor: body.factor != null ? Number(body.factor) : undefined,
          description: body.description,
          active: body.active,
        });
        return NextResponse.json({ ok: true, rule });
      }

      case "delete-rule": {
        deleteRule(body.id);
        return NextResponse.json({ ok: true, deleted: body.id });
      }

      case "add-alias": {
        const alias = addAlias({ alias: body.alias, target: body.target });
        return NextResponse.json({ ok: true, alias });
      }

      case "delete-alias": {
        deleteAlias(body.alias);
        return NextResponse.json({ ok: true, deleted: body.alias });
      }

      case "reset": {
        const store = resetToDefaults();
        return NextResponse.json({ ok: true, rules: store.rules.length, aliases: store.aliases.length });
      }

      default:
        return NextResponse.json({ error: `Bilinmeyen aksiyon: ${action}` }, { status: 400 });
    }
  } catch (err) {
    logger.exception("Kural motoru işlemi başarısız", err, {
      requestId: getRequestId(req),
      route: "/api/admin/rule-engine",
    });
    return NextResponse.json(
      { error: "Kural motoru işlemi şu anda tamamlanamadı." },
      { status: 500 }
    );
  }
}
