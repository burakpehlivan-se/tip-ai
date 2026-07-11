export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
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

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const store = loadRuleEngineStore();
  return NextResponse.json(store);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { requirePermission } = await import("@/lib/admin/permissions");
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
    console.error("rule-engine API failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "İşlem başarısız." },
      { status: 500 }
    );
  }
}
