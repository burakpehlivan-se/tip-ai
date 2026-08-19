/**
 * Kişisel veri talepleri için az-veri ilkeli iş akışı.
 *
 * Bu modül hesabı veya öğrenme kaydını kendiliğinden silmez. Talep yalnızca
 * tür, zaman ve çözüm durumu ile kayda alınır; serbest metin, vaka içeriği,
 * e-posta veya oturum bilgisi saklanmaz. Nihai silme/anonimleştirme kurumun
 * onaylı retention politikası ve yetkili operasyon süreciyle yapılmalıdır.
 */

import { randomUUID } from "node:crypto";
import { appendLog, loadLogsStore } from "@/lib/admin/store";
import { listAuthEventsByType, recordAuthEvent, type AuthEvent } from "@/lib/auth/audit";
import { storeMode } from "@/lib/store-mode";

export const PRIVACY_REQUEST_TYPES = ["correction", "erasure"] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];
export type PrivacyRequestStatus = "pending" | "resolved";

export type PrivacyRequest = {
  id: string;
  username: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requestedAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
};

const SUBMITTED_EVENT = "student_privacy_request_submitted" as const satisfies AuthEvent;
const RESOLVED_EVENT = "student_privacy_request_resolved" as const satisfies AuthEvent;

function asMetadata(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function privacyRequestType(value: unknown): PrivacyRequestType | null {
  return typeof value === "string" && (PRIVACY_REQUEST_TYPES as readonly string[]).includes(value)
    ? (value as PrivacyRequestType)
    : null;
}

type PrivacyEvent = {
  event: typeof SUBMITTED_EVENT | typeof RESOLVED_EVENT;
  username: string;
  actor?: string;
  meta: unknown;
  createdAt: number;
};

function materializeRequests(events: PrivacyEvent[]): PrivacyRequest[] {
  const requests = new Map<string, PrivacyRequest>();
  for (const event of [...events].sort((left, right) => {
    const timestampOrder = left.createdAt - right.createdAt;
    if (timestampOrder !== 0) return timestampOrder;
    // JSON audit olayları milisaniye çözünürlüğündedir. Aynı an için oluşturma
    // olayını önce yorumlamak, çözüm kaydının kaybolmasını engeller.
    return left.event === SUBMITTED_EVENT ? -1 : right.event === SUBMITTED_EVENT ? 1 : 0;
  })) {
    const metadata = asMetadata(event.meta);
    const requestId = typeof metadata?.requestId === "string" ? metadata.requestId : null;
    if (!requestId) continue;

    if (event.event === SUBMITTED_EVENT) {
      const type = privacyRequestType(metadata?.type);
      if (!type || requests.has(requestId)) continue;
      requests.set(requestId, {
        id: requestId,
        username: event.username,
        type,
        status: "pending",
        requestedAt: event.createdAt,
      });
      continue;
    }

    const request = requests.get(requestId);
    if (!request || request.status === "resolved") continue;
    request.status = "resolved";
    request.resolvedAt = event.createdAt;
    request.resolvedBy = event.actor;
  }
  return [...requests.values()].sort((left, right) => right.requestedAt - left.requestedAt);
}

async function readPrivacyEvents(username?: string, limit = 100): Promise<PrivacyEvent[]> {
  if (storeMode() === "postgres") {
    const events = await listAuthEventsByType([SUBMITTED_EVENT, RESOLVED_EVENT], { username, limit: limit * 2 });
    return events.map((event) => ({
      event: event.event as PrivacyEvent["event"],
      username: event.username,
      actor: event.actor || undefined,
      meta: event.meta,
      createdAt: event.createdAt.getTime(),
    }));
  }

  return loadLogsStore()
    .logs.filter(
      (log) =>
        (log.action === "student_privacy_request_submitted" || log.action === "student_privacy_request_resolved") &&
        (!username || log.actor === username)
    )
    .slice(0, limit * 2)
    .map((log) => ({
      event:
        log.action === "student_privacy_request_submitted"
          ? SUBMITTED_EVENT
          : RESOLVED_EVENT,
      username: log.actor,
      actor: typeof log.metadata?.resolvedBy === "string" ? log.metadata.resolvedBy : undefined,
      meta: log.metadata || null,
      createdAt: log.timestamp,
    }));
}

export async function listPrivacyRequests(options: { username?: string; limit?: number } = {}): Promise<PrivacyRequest[]> {
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 100), 1), 200);
  return materializeRequests(await readPrivacyEvents(options.username, limit)).slice(0, limit);
}

/** Aynı açık talep tekrarını önleyerek, bir gizlilik talebini denetim izine yazar. */
export async function submitPrivacyRequest(input: {
  username: string;
  type: PrivacyRequestType;
}): Promise<{ request: PrivacyRequest; created: boolean }> {
  const existing = (await listPrivacyRequests({ username: input.username, limit: 100 })).find(
    (request) => request.type === input.type && request.status === "pending"
  );
  if (existing) return { request: existing, created: false };

  const request: PrivacyRequest = {
    id: randomUUID(),
    username: input.username,
    type: input.type,
    status: "pending",
    requestedAt: Date.now(),
  };
  const metadata = { requestId: request.id, type: request.type };

  if (storeMode() === "postgres") {
    const recorded = await recordAuthEvent({
      event: SUBMITTED_EVENT,
      username: request.username,
      role: "ogrenci",
      actor: request.username,
      meta: metadata,
    });
    if (!recorded) throw new Error("Gizlilik talebi kaydedilemedi.");
  } else {
    appendLog({
      action: "student_privacy_request_submitted",
      actor: request.username,
      message: "Öğrenci gizlilik talebi oluşturdu.",
      patches: [],
      metadata,
    });
  }

  const persisted = (await listPrivacyRequests({ username: request.username, limit: 100 })).find(
    (item) => item.id === request.id
  );
  if (!persisted) throw new Error("Gizlilik talebi doğrulanamadı.");
  return { request: persisted, created: true };
}

/** Yetkili yönetici talebin operasyonel incelemesini tamamladığında çözüm kaydı ekler. */
export async function resolvePrivacyRequest(
  requestId: string,
  actor: string
): Promise<PrivacyRequest | null> {
  const request = (await listPrivacyRequests({ limit: 200 })).find((item) => item.id === requestId);
  if (!request) return null;
  if (request.status === "resolved") return request;

  const metadata = { requestId: request.id, resolvedBy: actor };
  if (storeMode() === "postgres") {
    const recorded = await recordAuthEvent({
      event: RESOLVED_EVENT,
      username: request.username,
      role: "ogrenci",
      actor,
      meta: metadata,
    });
    if (!recorded) throw new Error("Gizlilik talebi çözümlenmiş olarak kaydedilemedi.");
  } else {
    appendLog({
      action: "student_privacy_request_resolved",
      actor: request.username,
      message: "Öğrenci gizlilik talebi çözümlendi.",
      patches: [],
      metadata,
    });
  }

  return { ...request, status: "resolved", resolvedAt: Date.now(), resolvedBy: actor };
}
