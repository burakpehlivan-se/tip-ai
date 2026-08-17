import { eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { radiologySources } from "@/lib/auth/schema";
import type { TestSonucu } from "@/lib/types";

export const RADIOLOGY_TEST_KEY = "AKCIGER_GRAFISI";
export const RADIOLOGY_TEST_NAME = "PA Akciğer Grafisi";

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
  const [source] = await getDb()
    .select({ imageIndex: radiologySources.imageIndex, findingLabel: radiologySources.findingLabel })
    .from(radiologySources)
    .where(eq(radiologySources.caseId, caseId))
    .limit(1);
  if (!source) return null;

  return {
    testKey: RADIOLOGY_TEST_KEY,
    testAdi: RADIOLOGY_TEST_NAME,
    tip: "image",
    sonuc: {
      imageUrl: `/api/student/attempts/${attemptId}/radiology-image`,
      imageIndex: source.imageIndex,
      findingLabel: source.findingLabel,
    },
    referans: "NIH ChestX-ray14",
    yorum: `Görüntü eşleşen bulgu etiketi: ${source.findingLabel}.`,
    source: "dataset",
  };
}
