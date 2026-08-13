import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const DEVELOPMENT_SECRET = randomBytes(32).toString("base64url");

export type CdmImportPlanBinding = {
  actor: string;
  overwrite: boolean;
  storeUpdatedAt: number;
  documents: Array<{ id: string; checksum: string }>;
};

type SignedPlan = CdmImportPlanBinding & {
  version: number;
  expiresAt: number;
};

function signingSecret(): string {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ADMIN_SESSION_SECRET) {
      throw new Error("CDM import onayı için ADMIN_SESSION_SECRET production ortamında zorunludur.");
    }
    return process.env.ADMIN_SESSION_SECRET;
  }
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || DEVELOPMENT_SECRET;
}

function normalizeBinding(binding: CdmImportPlanBinding): CdmImportPlanBinding {
  return {
    actor: binding.actor.trim().toLowerCase(),
    overwrite: binding.overwrite,
    storeUpdatedAt: binding.storeUpdatedAt,
    documents: binding.documents.map((document) => ({ id: document.id, checksum: document.checksum })),
  };
}

function sign(encoded: string): string {
  return createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
}

function equalSignature(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Dry-run planını belirli kullanıcı, store sürümü ve belge gövdesine bağlar. */
export function createCdmImportConfirmation(binding: CdmImportPlanBinding, now = Date.now()) {
  const payload: SignedPlan = {
    version: TOKEN_VERSION,
    ...normalizeBinding(binding),
    expiresAt: now + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { token: `${encoded}.${sign(encoded)}`, expiresAt: payload.expiresAt };
}

/** Token yalnızca aynı kullanıcı, aynı dry-run planı ve güncel store için geçerlidir. */
export function verifyCdmImportConfirmation(
  token: string | null,
  binding: CdmImportPlanBinding,
  now = Date.now()
): boolean {
  if (!token) return false;
  const [encoded, signature, ...extra] = token.split(".");
  if (!encoded || !signature || extra.length > 0 || !equalSignature(signature, sign(encoded))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedPlan;
    const expected = normalizeBinding(binding);
    return (
      payload.version === TOKEN_VERSION &&
      payload.expiresAt >= now &&
      payload.actor === expected.actor &&
      payload.overwrite === expected.overwrite &&
      payload.storeUpdatedAt === expected.storeUpdatedAt &&
      JSON.stringify(payload.documents) === JSON.stringify(expected.documents)
    );
  } catch {
    return false;
  }
}
