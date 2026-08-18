import { eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { radiologySources } from "@/lib/auth/schema";
import type { TestSonucu } from "@/lib/types";

export const RADIOLOGY_TEST_KEY = "AKCIGER_GRAFISI";
export const RADIOLOGY_TEST_NAME = "PA Akciğer Grafisi";

async function getRadiologyTestResultForUrl(
  caseId: string,
  imageUrl: string,
  includeFindingLabel: boolean
): Promise<TestSonucu | null> {
  const [source] = await getDb()
    .select({ imageIndex: radiologySources.imageIndex, findingLabel: radiologySources.findingLabel })
    .from(radiologySources)
    .where(eq(radiologySources.caseId, caseId))
    .limit(1);
  if (!source) return null;

  const sonuc: Record<string, unknown> = { imageUrl, imageIndex: source.imageIndex };
  if (includeFindingLabel) sonuc.findingLabel = source.findingLabel;

  return {
    testKey: RADIOLOGY_TEST_KEY,
    testAdi: RADIOLOGY_TEST_NAME,
    tip: "image",
    sonuc,
    referans: "NIH ChestX-ray14",
    yorum: includeFindingLabel
      ? `Görüntü eşleşen bulgu etiketi: ${source.findingLabel}.`
      : "Radyolojik inceleme tamamlandı.",
    source: "dataset",
  };
}

export async function hasRadiologyTest(caseId: string): Promise<boolean> {
  const [source] = await getDb()
    .select({ caseId: radiologySources.caseId })
    .from(radiologySources)
    .where(eq(radiologySources.caseId, caseId))
    .limit(1);
  return Boolean(source);
}

export async function getRadiologyTestResult(
  attemptId: string,
  caseId: string
): Promise<TestSonucu | null> {
  return getRadiologyTestResultForUrl(caseId, `/api/student/attempts/${attemptId}/radiology-image`, false);
}

/** Admin debug oynatımında yetkili görüntü endpoint'ine bağlanan sonuç. */
export async function getAdminRadiologyTestResult(caseId: string): Promise<TestSonucu | null> {
  if (!process.env.DATABASE_URL) return null;
  return getRadiologyTestResultForUrl(
    caseId,
    `/api/admin/cases/${encodeURIComponent(caseId)}/radiology-image`,
    true
  );
}
