import { eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { ekgSources } from "@/lib/auth/schema";
import type { TestSonucu } from "@/lib/types";

export const EKG_TEST_KEY = "EKG";
export const EKG_TEST_NAME = "EKG (12 Derivasyon)";

async function getEkgTestResultForUrl(caseId: string, imageUrl: string): Promise<TestSonucu | null> {
  const [source] = await getDb()
    .select({ imageIndex: ekgSources.imageIndex, findingLabel: ekgSources.findingLabel })
    .from(ekgSources)
    .where(eq(ekgSources.caseId, caseId))
    .limit(1);
  if (!source) return null;

  return {
    testKey: EKG_TEST_KEY,
    testAdi: EKG_TEST_NAME,
    tip: "image",
    sonuc: { imageUrl, imageIndex: source.imageIndex, findingLabel: source.findingLabel },
    referans: "PTB-XL",
    yorum: `EKG bulgusu: ${source.findingLabel}.`,
    source: "dataset",
  };
}

export async function hasEkgTest(caseId: string): Promise<boolean> {
  const [source] = await getDb()
    .select({ caseId: ekgSources.caseId })
    .from(ekgSources)
    .where(eq(ekgSources.caseId, caseId))
    .limit(1);
  return Boolean(source);
}

export async function getEkgTestResult(attemptId: string, caseId: string): Promise<TestSonucu | null> {
  return getEkgTestResultForUrl(caseId, `/api/student/attempts/${attemptId}/ekg-image`);
}

/** Admin debug oynatımında yetkili görüntü endpoint'ine bağlanan sonuç. */
export async function getAdminEkgTestResult(caseId: string): Promise<TestSonucu | null> {
  if (!process.env.DATABASE_URL) return null;
  return getEkgTestResultForUrl(caseId, `/api/admin/cases/${encodeURIComponent(caseId)}/ekg-image`);
}
