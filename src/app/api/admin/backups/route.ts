export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { createBackup, loadBackupsIndex, loadCasesStore } from "@/lib/admin/store";
import { caseStoreMode } from "@/lib/admin/postgres-case-store-mode";
import { backupsDir } from "@/lib/admin/paths";

import { requirePermission } from "@/lib/admin/permissions";

const MAX_BACKUPS = 100;

function backupSizeBytes(filename: string): number {
  try {
    return fs.statSync(path.join(backupsDir(), filename)).size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "backups.read");
  if (denied) return denied;
  if (caseStoreMode() === "postgres") {
    return NextResponse.json(
      { error: "PostgreSQL vaka kaynağında uygulama-içi JSON yedekleri kullanılamaz." },
      { status: 409 }
    );
  }

  const index = loadBackupsIndex();
  const store = loadCasesStore();
  const nextAutoAt = store.changeCount > 0 ? Math.ceil(store.changeCount / 10) * 10 : 10;
  return NextResponse.json({
    backups: index.backups.map((backup) => ({
      ...backup,
      sizeBytes: backupSizeBytes(backup.filename),
      sizeLabel: formatBytes(backupSizeBytes(backup.filename)),
    })),
    changeCount: store.changeCount,
    nextAutoAt,
    retention: { max: MAX_BACKUPS, threshold: 10 },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "backups.restore");
  if (denied) return denied;
  if (caseStoreMode() === "postgres") {
    return NextResponse.json(
      { error: "PostgreSQL vaka kaynağında uygulama-içi JSON yedekleri kullanılamaz." },
      { status: 409 }
    );
  }

  const meta = createBackup("manual", session!.username);
  return NextResponse.json({ ok: true, backup: meta });
}
