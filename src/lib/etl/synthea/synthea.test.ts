import { describe, expect, it } from "vitest";
import { etlSyntheaPatientToCdm } from "./pipeline";
import {
  localizeSmokingStatus,
  mapSyntheaLoincToTestKey,
  resolveDiseaseFromCondition,
  resolveDiseaseFromSnomed,
  turkishNameForSnomed,
} from "./mappings";
import { localizeMedicationName } from "./medications";
import { SyntheaEpisodeBundle } from "./types";

function patient(overrides: Partial<SyntheaEpisodeBundle["patient"]> = {}) {
  return {
    id: "test-patient-1",
    birthdate: new Date("1970-01-01T00:00:00Z"),
    deathdate: null,
    first: "John",
    last: "Doe",
    gender: "M",
    race: "white",
    ethnicity: "nonhispanic",
    marital: null,
    city: null,
    state: null,
    zip: null,
    ...overrides,
  };
}

function condition(code: string, description: string) {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    patientId: "test-patient-1",
    encounterId: null,
    start: null,
    stop: null,
    code,
    description,
  };
}

function observation(code: string, value: string, units: string | null = null) {
  const valueNum = Number(value);
  return {
    id: Math.floor(Math.random() * 1_000_000),
    patientId: "test-patient-1",
    encounterId: null,
    date: new Date("2024-01-15T10:00:00Z"),
    category: "laboratory",
    code,
    description: null,
    value,
    valueNum: Number.isFinite(valueNum) ? valueNum : null,
    units,
    type: Number.isFinite(valueNum) ? "numeric" : "text",
  };
}

function pneumoniaBundle(): SyntheaEpisodeBundle {
  return {
    source: "synthea",
    patient: patient(),
    conditions: [condition("233604007", "Pneumonia (disorder)")],
    observations: [
      observation("2339-0", "110", "mg/dL"),
      observation("38483-4", "1.0", "mg/dL"),
      observation("2947-0", "138", "mmol/L"),
      observation("6298-4", "4.2", "mmol/L"),
      observation("718-7", "13.5", "g/dL"),
      observation("6690-2", "14", "K/uL"),
      observation("777-3", "220", "K/uL"),
      observation("1988-5", "85", "mg/L"),
      observation("8480-6", "124", "mm[Hg]"),
      observation("8462-4", "78", "mm[Hg]"),
      observation("8867-4", "96", "/min"),
      observation("9279-1", "20", "/min"),
      observation("8310-5", "38.4", "Cel"),
      observation("2708-6", "93", "%"),
      observation("39156-5", "27.5", "kg/m2"),
    ],
    medications: [],
    procedures: [],
    encounters: [],
    imagingStudies: [],
  };
}

describe("Synthea ETL mappings", () => {
  it("SNOMED kodunu hastalığa eşler", () => {
    expect(resolveDiseaseFromSnomed(["233604007"])?.hastalikKey).toBe("pnomoni");
    expect(resolveDiseaseFromSnomed(["59621000"])?.hastalikKey).toBe("hipertansiyon");
    expect(resolveDiseaseFromSnomed(["66383009"])).toBeNull();
  });

  it("LOINC kodunu granüler testKey'e eşler", () => {
    expect(mapSyntheaLoincToTestKey({ loinc: "2947-0" })).toBe("NA");
    expect(mapSyntheaLoincToTestKey({ loinc: "718-7" })).toBe("HGB");
    expect(mapSyntheaLoincToTestKey({ loinc: "2093-3" })).toBe("CHOL");
    expect(mapSyntheaLoincToTestKey({ loinc: "76501-6" })).toBeNull();
  });

  it("SNOMED kodunu Türkçe tanı adına çevirir", () => {
    expect(turkishNameForSnomed("233604007")).toBe("Pnömoni");
    expect(turkishNameForSnomed("59621000")).toBe("Esansiyel Hipertansiyon");
    expect(turkishNameForSnomed("999999999")).toBeUndefined();
  });

  it("eşlemesiz kaynak tanıyı kod-bazlı katalog vakasına dönüştürür", () => {
    const disease = resolveDiseaseFromCondition({
      code: "200936003",
      description: "Lupus erythematosus (disorder)",
    });
    expect(disease).toMatchObject({
      hastalikKey: "synthea-tani-200936003",
      hastalikAdi: "Lupus eritematozus",
      poliklinikKey: "dahiliye",
      snomedCodes: ["200936003"],
    });
  });

  it("sigara durumunu Türkçeleştirir", () => {
    expect(localizeSmokingStatus("Never smoked tobacco (finding)")).toBe("Sigara içmiyor");
    expect(localizeSmokingStatus("Smokes tobacco daily (finding)")).toBe("Her gün sigara içiyor");
    expect(localizeSmokingStatus("")).toBeUndefined();
  });

  it("bilinen RxNorm kodunu Türkçe jenerik ada çevirir, bilinmeyeni olduğu gibi bırakır", () => {
    expect(localizeMedicationName("860975", "24 HR Metformin hydrochloride 500 MG")).toBe("Metformin");
    expect(localizeMedicationName(null, "Some Unknown Drug")).toBe("Some Unknown Drug");
    expect(localizeMedicationName(null, null)).toBe("İlaç");
  });
});

describe("Synthea ETL pipeline", () => {
  it("sentetik hastayı kimlik sızdırmadan CDM taslağına dönüştürür", () => {
    const result = etlSyntheaPatientToCdm(pneumoniaBundle());
    expect(result).not.toBeNull();
    const { vaka, validation, meta } = result!;

    expect(vaka.meta.hastalikKey).toBe("pnomoni");
    expect(vaka.meta.hastalikAdi).toBe("Pnömoni");
    expect(vaka.meta.durum).toBe("taslak");

    expect(vaka.conditions?.[0]).toMatchObject({ code: "233604007", system: "snomed", primary: true });
    expect(vaka.conditions?.[0].ad).toBe("Pnömoni");

    expect(vaka.labs.statikTestler.GLUKOZ).toBeDefined();
    expect(vaka.labs.statikTestler.HGB).toBeDefined();
    expect(vaka.labs.statikTestler.CRP).toBeDefined();

    expect(vaka.vitals?.nabiz).toBe(96);
    expect(vaka.vitals?.ates).toBe(38.4);
    expect(vaka.vitals?.spo2).toBe(93);

    expect(vaka.id).not.toContain("test-patient-1");
    expect(JSON.stringify(vaka)).not.toContain("test-patient-1");
    expect(meta).toEqual(expect.objectContaining({ source: "synthea", patientToken: expect.any(String) }));
    expect(meta.patientToken).toHaveLength(16);

    expect(validation.status).not.toBe("invalid");
  });

  it("yalnızca dental/sosyal kaydı olan hastayı atlar (null döner)", () => {
    const bundle: SyntheaEpisodeBundle = {
      ...pneumoniaBundle(),
      conditions: [
        condition("66383009", "Gingivitis (disorder)"),
        condition("160903007", "Full-time employment (finding)"),
      ],
    };
    expect(etlSyntheaPatientToCdm(bundle)).toBeNull();
  });

  it("istenen eşlemesiz tanıyı da birincil vaka olarak üretir", () => {
    const bundle = pneumoniaBundle();
    bundle.conditions = [condition("200936003", "Lupus erythematosus (disorder)")];
    const result = etlSyntheaPatientToCdm(bundle, { primaryConditionCode: "200936003" });
    expect(result?.vaka.meta).toMatchObject({
      hastalikKey: "synthea-tani-200936003",
      hastalikAdi: "Lupus eritematozus",
    });
    expect(result?.vaka.conditions?.[0]).toMatchObject({ code: "200936003", primary: true });
  });

  it("beklenen test sonucu yoksa iskelet doldurur (doğrulama hatası üretmez)", () => {
    const bundle = pneumoniaBundle();
    // AKCIGER_GRAFISI bekleniyor ama kayıtta yok → stub üretilmeli
    const result = etlSyntheaPatientToCdm(bundle);
    expect(result).not.toBeNull();
    expect(result!.vaka.labs.statikTestler.AKCIGER_GRAFISI).toBeDefined();
    expect(result!.validation.errors).toEqual([]);
  });
});
