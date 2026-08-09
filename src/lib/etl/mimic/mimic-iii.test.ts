import { afterEach, describe, expect, it } from "vitest";
import { etlMimicEpisodeToCdm } from "./pipeline";
import { buildMimicIIIEpisode } from "./mimic-iii";
import { resolveDiseaseFromIcd } from "./mappings";

const previousSalt = process.env.MIMIC_EPISODE_HASH_SALT;

afterEach(() => {
  if (previousSalt === undefined) delete process.env.MIMIC_EPISODE_HASH_SALT;
  else process.env.MIMIC_EPISODE_HASH_SALT = previousSalt;
});

describe("MIMIC-III episode adapter", () => {
  it("aynı yatıştaki ICD-9 ve laboratuvar satırlarını, kimlik sızdırmadan CDM taslağına dönüştürür", () => {
    const episode = buildMimicIIIEpisode(
      {
        patients: [{ subject_id: 100001, gender: "F", dob: "2090-04-10" }],
        admissions: [{ subject_id: 100001, hadm_id: 200001, admittime: "2145-05-10 09:00:00" }],
        diagnoses: [{ subject_id: 100001, hadm_id: 200001, seq_num: 1, icd9_code: "5853" }],
        diagnosisDictionary: [{ icd9_code: "5853", long_title: "Chronic kidney disease, Stage III" }],
        labItems: [{ itemid: 50912, label: "Creatinine" }],
        labevents: [
          { subject_id: 100001, hadm_id: 200001, itemid: 50912, charttime: "2145-05-10 10:00:00", valuenum: 2.1, valueuom: "mg/dL", flag: "abnormal" },
          { subject_id: 100001, hadm_id: null, itemid: 50912, valuenum: 1.2 },
          { subject_id: 100001, hadm_id: 999999, itemid: 50912, valuenum: 9.9 },
        ],
      },
      { subjectId: 100001, hadmId: 200001 }
    );

    expect(episode.bundle.source).toBe("mimic-iii");
    expect(episode.bundle.diagnoses[0].icd_version).toBe(9);
    expect(episode.bundle.patient).toMatchObject({ anchor_age: 55, age_quality: "derived" });
    expect(episode.bundle.labs).toHaveLength(1);
    expect(episode.quality.labsExcludedOutsideAdmission).toBe(2);

    process.env.MIMIC_EPISODE_HASH_SALT = "test-only-salt";
    const result = etlMimicEpisodeToCdm(episode.bundle);
    expect(result.vaka.meta.hastalikKey).toBe("kbh");
    expect(result.vaka.conditions?.[0]).toMatchObject({ code: "5853", system: "icd9" });
    expect(result.vaka.labs.statikTestler.KREATININ).toBeDefined();
    expect(result.vaka.id).not.toContain("100001");
    expect(JSON.stringify(result.vaka)).not.toContain("200001");
    expect(result.meta).toEqual(expect.objectContaining({ source: "mimic-iii", episodeId: expect.any(String) }));
    expect(result.meta).not.toHaveProperty("subject_id");
    expect(result.meta).not.toHaveProperty("hadm_id");
  });

  it("MIMIC-III importunda gizli episode anahtarı olmadan çalışmaz", () => {
    const { bundle } = buildMimicIIIEpisode(
      {
        patients: [{ subject_id: "s", gender: "M", dob: "2090-01-01" }],
        admissions: [{ subject_id: "s", hadm_id: "h", admittime: "2145-01-01" }],
        diagnoses: [{ subject_id: "s", hadm_id: "h", icd9_code: "5853" }],
      },
      { subjectId: "s", hadmId: "h" }
    );
    delete process.env.MIMIC_EPISODE_HASH_SALT;
    expect(() => etlMimicEpisodeToCdm(bundle)).toThrow("MIMIC_EPISODE_HASH_SALT");
  });

  it("ICD-9 250.* kodundan Tip 2 diyabeti otomatik atamaz", () => {
    expect(resolveDiseaseFromIcd([{ icd_code: "25000", icd_version: 9 }])).toBeNull();
  });
});
