import {
  pgEnum,
  pgTable,
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  jsonb,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Panel rolleri — "ogrenci" öğrenci tarafı hesabıdır (panel erişimi yok) */
export const userRole = pgEnum("user_role", ["admin", "doktor", "ogrenci"]);
export const learningAttemptStatus = pgEnum("learning_attempt_status", [
  "active",
  "completed",
  "abandoned",
  "expired",
]);
export const clinicalCaseStatus = pgEnum("clinical_case_status", ["taslak", "aktif", "arsiv"]);
/** Independent source-record catalogue lifecycle states. */
export const imagingImportRunStatus = pgEnum("imaging_import_run_status", [
  "running",
  "succeeded",
  "failed",
  "review_required",
]);
export const imagingRenderRunStatus = pgEnum("imaging_render_run_status", ["running", "succeeded", "failed"]);
export const imagingRecordAvailability = pgEnum("imaging_record_availability", [
  "indexed",
  "display_ready",
  "unavailable",
  "stale",
  "retired",
]);
export const imagingTaxonomyStatus = pgEnum("imaging_taxonomy_status", ["draft", "active", "retired"]);
export const imagingAttemptStatus = pgEnum("imaging_attempt_status", [
  "active",
  "submitted",
  "completed",
  "abandoned",
]);

/**
 * Tek kimlik deposu: yalnızca giriş bilgileri ve rol tutulur.
 * Hasta/sağlık verisi asla buraya yazılmaz.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** normalize edilmiş küçük harf benzersiz kullanıcı adı */
  username: text("username").notNull().unique(),
  /** opsiyonel; doluysa benzersiz olmalı */
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("ogrenci"),
  active: boolean("active").notNull().default(true),
  displayName: text("display_name"),
  /** Bootstrap süper admin — rol/aktiflik/silme değiştirilemez */
  superAdmin: boolean("super_admin").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export type UserRole = "admin" | "doktor" | "ogrenci";

export const authAuditLogs = pgTable("auth_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * login_failed | register_student | role_change | account_deactivated ...
   * Kişisel/hasta verisi içermez. Yalnızca giriş olayı ve rol değişikliği.
   */
  event: text("event").notNull(),
  username: text("username").notNull(),
  role: text("role"),
  actor: text("actor"),
  ip: text("ip"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuthAuditLog = typeof authAuditLogs.$inferSelect;

/**
 * PostgreSQL runtime modunda imzalı cookie'nin sunucu tarafındaki kaydı.
 * Token saklanmaz; yalnızca rastgele oturum kimliği, kullanıcı ve süre tutulur.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    /** Ham user-agent saklanmaz; yalnızca türetilmiş kısa cihaz etiketi tutulur. */
    deviceLabel: text("device_label"),
    /** Idle timeout ve kullanıcının oturum listesi için en son doğrulanan etkinlik. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("auth_sessions_user_id_idx").on(table.userId),
    index("auth_sessions_user_active_idx").on(table.userId, table.revokedAt, table.expiresAt),
  ]
);

export type AuthSession = typeof authSessions.$inferSelect;

/**
 * Çoklu replica'da ortak login/kayıt kotası. Anahtar zaten SHA-256 özeti
 * olduğundan ham IP veya kullanıcı adı saklanmaz; kayıtlar kısa ömürlüdür.
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    bucketKey: text("bucket_key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rate_limit_buckets_reset_at_idx").on(table.resetAt)]
);

/**
 * P2 expand adımı: yalnızca giriş yapmış öğrencilerin vaka denemeleri.
 * Vaka içeriğinin ve skorun sürüm-kilitli gövdesi JSONB'de, sahiplik ve yaşam
 * döngüsü alanları ise sorgulanabilir ilişkisel kolonlarda tutulur. Guest
 * denemeler ile JSON'dan aktarım bu tabloyu kullanan sonraki sürümlerdedir.
 */
export const learningAttempts = pgTable(
  "learning_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Grup atamasıyla açılan oturumun isteğe bağlı kaynağı. Legacy denemeler boş kalır. */
    assignmentId: uuid("assignment_id").references(() => cohortCaseAssignments.id, { onDelete: "set null" }),
    caseId: text("case_id").notNull(),
    caseVersion: text("case_version"),
    poliklinikKey: text("poliklinik_key").notNull(),
    /** Denemeye atanan hasta tipi (üslup çeşitliliği); yoksa nötr/sakin varsayılır. */
    hastaTipiId: text("hasta_tipi_id"),
    status: learningAttemptStatus("status").notNull().default("active"),
    /** Deneme başladığındaki vaka/rubrik içeriği; sonradan içerik değişse de skor korunur. */
    caseSnapshot: jsonb("case_snapshot").notNull(),
    askedActions: jsonb("asked_actions").notNull(),
    requestedTests: jsonb("requested_tests").notNull(),
    /** İstenen vital/fizik muayene bulguları; tetkik sonuçlarından ayrıdır. */
    examFindings: jsonb("exam_findings").$type<Array<{ action: string; label: string; answer: string }>>().notNull().default([]),
    /** Ham soru, açılan slotlar ve hasta yanıtı; devam eden oturumun birebir tekrarı için. */
    answers: jsonb("answers").$type<Array<{
      question: string;
      actions: string[];
      answer: string;
      channel: "hasta" | "muayene" | "tetkik" | "belirsiz";
    }>>(),
    /** Aktif denemenin öğrencinin sahip olduğu, doğrulanmış muhakeme taslağı. */
    clinicalReasoning: jsonb("clinical_reasoning"),
    evaluation: jsonb("evaluation"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("learning_attempts_student_status_updated_idx").on(
      table.studentId,
      table.status,
      table.updatedAt
    ),
    index("learning_attempts_case_id_idx").on(table.caseId),
    index("learning_attempts_student_assignment_status_updated_idx").on(
      table.studentId,
      table.assignmentId,
      table.status,
      table.updatedAt
    ),
  ]
);

export type LearningAttempt = typeof learningAttempts.$inferSelect;

/**
 * Hasta tipi üslup dönüşümü önbelleği. Klinik gerçek cevap sabitken yalnızca
 * üslup (hasta tipi) değişir; dönüştürülmüş cevap (vaka, tip, soru) üçlüsüne
 * göre tembelce üretilip saklanır. `orijinalCevap` taban yanıtın değişip
 * değişmediğini doğrulayarak kendi kendini geçersiz kılar.
 */
export const cevapCache = pgTable(
  "cevap_cache",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    vakaId: text("vaka_id").notNull(),
    hastaTipiId: text("hasta_tipi_id").notNull(),
    actionKey: text("action_key").notNull(),
    orijinalCevap: text("orijinal_cevap").notNull(),
    donusturulmusCevap: text("donusturulmus_cevap").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cevap_cache_vaka_tip_action_idx").on(table.vakaId, table.hastaTipiId, table.actionKey),
    index("cevap_cache_vaka_tip_idx").on(table.vakaId, table.hastaTipiId),
  ]
);

export type CevapCacheRow = typeof cevapCache.$inferSelect;

/**
 * P2 expand adımı: düzenlenebilir vaka gövdesinin PostgreSQL doğruluk kaynağı.
 * Klinik gövde JSONB'de esnek kalırken durum, sürüm, checksum ve zaman alanları
 * ilişkisel kalır; böylece filtreleme, iyimser kilitleme ve denetim mümkün olur.
 *
 * JSON runtime henüz kaldırılmamıştır. Bu tablo önce idempotent import ve
 * eşitlik denetimi için hazırlanır; okuma/yazma cutover'ı ayrı bir feature flag
 * ve rollback kanıtı ile yapılacaktır.
 */
export const clinicalCases = pgTable(
  "clinical_cases",
  {
    caseId: text("case_id").primaryKey(),
    poliklinikKey: text("poliklinik_key").notNull(),
    status: clinicalCaseStatus("status").notNull(),
    reviewStatus: text("review_status").notNull().default("legacy"),
    version: integer("version").notNull(),
    contentChecksum: text("content_checksum"),
    /** Tam AdminVaka gövdesi; relational indeks alanları yukarıda ayrıdır. */
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("clinical_cases_poliklinik_status_updated_idx").on(
      table.poliklinikKey,
      table.status,
      table.updatedAt
    ),
    index("clinical_cases_status_review_updated_idx").on(
      table.status,
      table.reviewStatus,
      table.updatedAt
    ),
  ]
);

export type ClinicalCase = typeof clinicalCases.$inferSelect;

/**
 * Öğrencinin gördüğü reviewer-imzalı sürümün append-only kaydı. Case tablosuna
 * foreign key verilmez: bir vaka geri çekilse bile geçmiş deneme/sürüm kanıtı
 * korunur; silme işlemi gelecekte arşivleme olarak uygulanmalıdır.
 */
export const publishedClinicalCaseVersions = pgTable(
  "published_clinical_case_versions",
  {
    caseId: text("case_id").notNull(),
    version: integer("version").notNull(),
    contentChecksum: text("content_checksum").notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
    content: jsonb("content").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.caseId, table.version],
      name: "published_clinical_case_versions_pkey",
    }),
    index("published_clinical_case_versions_case_approved_idx").on(
      table.caseId,
      table.approvedAt
    ),
  ]
);

export type PublishedClinicalCaseVersion = typeof publishedClinicalCaseVersions.$inferSelect;

/**
 * P2 vaka denetim izi. Klinik vaka gövdesi veya serbest hasta bilgisi burada
 * tekrar tutulmaz; değişikliğin yalnızca güvenli özeti ve yapısal alanları
 * kaydedilir. Geçmiş sürümler ile ilişki kurulmaz çünkü vaka geri çekilse bile
 * denetim kanıtı korunmalıdır.
 */
export const clinicalCaseAuditLogs = pgTable(
  "clinical_case_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: text("case_id").notNull(),
    event: text("event").notNull(),
    actor: text("actor").notNull(),
    /** İnsan-okur güvenli özet; ham vaka veya parola/bağlantı bilgisi içermez. */
    summary: text("summary").notNull(),
    /** Sadece alan adı, önceki/sonraki sürüm, işlem kimliği gibi yapılandırılmış metadata. */
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("clinical_case_audit_logs_case_created_idx").on(table.caseId, table.createdAt),
    index("clinical_case_audit_logs_actor_created_idx").on(table.actor, table.createdAt),
  ]
);

export type ClinicalCaseAuditLog = typeof clinicalCaseAuditLogs.$inferSelect;

/**
 * P2 sınıf/grup kapsamı. Grup üyeliği yalnızca kimlik bilgisi taşır; klinik
 * oturumların gövdesi bu tabloda tutulmaz. Böylece eğitmen atamalarının
 * kapsamı sorgulanabilir kalır ve sağlık verisi ile kimlik verisi ayrışır.
 */
export const cohorts = pgTable(
  "cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cohorts_name_unique").on(table.name),
    index("cohorts_active_updated_idx").on(table.active, table.updatedAt),
  ]
);

/** Bir öğrencinin gruba üyeliği; bileşik anahtar yinelenen üyeliği engeller. */
export const cohortMemberships = pgTable(
  "cohort_memberships",
  {
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.cohortId, table.studentId], name: "cohort_memberships_pkey" }),
    index("cohort_memberships_student_id_idx").on(table.studentId),
  ]
);

/**
 * Bir grubun sürüm-kilitli vaka ataması. Vaka kataloğu henüz JSON deposunda
 * olduğundan caseId/caseVersion bilinçli olarak ilişkisel olmayan referanstır;
 * atama oluşturma akışı bu kimliği yayımdaki vakaya karşı doğrulamalıdır.
 */
export const cohortCaseAssignments = pgTable(
  "cohort_case_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull(),
    caseVersion: text("case_version").notNull(),
    title: text("title"),
    instructions: text("instructions"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cohort_case_assignments_cohort_case_version_unique").on(
      table.cohortId,
      table.caseId,
      table.caseVersion
    ),
    index("cohort_case_assignments_cohort_due_idx").on(table.cohortId, table.dueAt),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// Synthea DB — sentetik hasta verisi (yüklenmiş CSV'lerden).
// ETL bu tablolardan okur ve eğitim vakası üretir. Ham kaynak `data/raw/synthea/`
// klasörüdür; bu tablolar o verinin ilişkisel, sorgulanabilir kopyasıdır.
// Synthea verisi tamamen sentetiktir; gerçek kişi/PHI içermez.
// ═══════════════════════════════════════════════════════════════════════════

export const syntheaPatients = pgTable(
  "synthea_patients",
  {
    /** Synthea UUID (kaynak Id) */
    id: text("id").primaryKey(),
    birthdate: timestamp("birthdate", { withTimezone: true }),
    deathdate: timestamp("deathdate", { withTimezone: true }),
    first: text("first"),
    last: text("last"),
    gender: text("gender").notNull(),
    race: text("race"),
    ethnicity: text("ethnicity"),
    marital: text("marital"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
  },
  (table) => [index("synthea_patients_gender_idx").on(table.gender)]
);

export type SyntheaPatient = typeof syntheaPatients.$inferSelect;

export const syntheaConditions = pgTable(
  "synthea_conditions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** FHIR resource kimliği veya içerikten türetilen sabit özet; tekrar yüklemeyi tekilleştirir. */
    sourceId: text("source_id").unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    start: timestamp("start", { withTimezone: true }),
    stop: timestamp("stop", { withTimezone: true }),
    /** SNOMED-CT kodu */
    code: text("code").notNull(),
    codeSystem: text("code_system"),
    description: text("description").notNull(),
  },
  (table) => [
    index("synthea_conditions_patient_idx").on(table.patientId),
    index("synthea_conditions_code_idx").on(table.code),
  ]
);

export type SyntheaCondition = typeof syntheaConditions.$inferSelect;

export const syntheaObservations = pgTable(
  "synthea_observations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** FHIR resource kimliği veya içerikten türetilen sabit özet; tekrar yüklemeyi tekilleştirir. */
    sourceId: text("source_id").unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    date: timestamp("date", { withTimezone: true }),
    category: text("category"),
    /** LOINC kodu */
    code: text("code").notNull(),
    codeSystem: text("code_system"),
    description: text("description"),
    /** Ham değer (metin; numeric olmayanlar için de kullanılır) */
    value: text("value"),
    /** VALUE sayıya dönüşebiliyorsa ayrıca numeric kolona yazılır */
    valueNum: doublePrecision("value_num"),
    units: text("units"),
    type: text("type"),
  },
  (table) => [
    index("synthea_observations_patient_idx").on(table.patientId),
    index("synthea_observations_code_idx").on(table.code),
  ]
);

export type SyntheaObservation = typeof syntheaObservations.$inferSelect;

export const syntheaMedications = pgTable(
  "synthea_medications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** FHIR resource kimliği veya içerikten türetilen sabit özet; tekrar yüklemeyi tekilleştirir. */
    sourceId: text("source_id").unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    start: timestamp("start", { withTimezone: true }),
    stop: timestamp("stop", { withTimezone: true }),
    /** RxNorm kodu */
    code: text("code"),
    codeSystem: text("code_system"),
    description: text("description"),
    reasonCode: text("reason_code"),
    reasonDescription: text("reason_description"),
  },
  (table) => [
    index("synthea_medications_patient_idx").on(table.patientId),
    index("synthea_medications_code_idx").on(table.code),
  ]
);

export type SyntheaMedication = typeof syntheaMedications.$inferSelect;

export const syntheaProcedures = pgTable(
  "synthea_procedures",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** FHIR resource kimliği veya içerikten türetilen sabit özet; tekrar yüklemeyi tekilleştirir. */
    sourceId: text("source_id").unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    start: timestamp("start", { withTimezone: true }),
    stop: timestamp("stop", { withTimezone: true }),
    /** SNOMED-CT kodu */
    code: text("code"),
    codeSystem: text("code_system"),
    description: text("description"),
    reasonCode: text("reason_code"),
    reasonDescription: text("reason_description"),
  },
  (table) => [
    index("synthea_procedures_patient_idx").on(table.patientId),
    index("synthea_procedures_code_idx").on(table.code),
  ]
);

export type SyntheaProcedure = typeof syntheaProcedures.$inferSelect;

export const syntheaEncounters = pgTable(
  "synthea_encounters",
  {
    /** Synthea UUID (kaynak Id) */
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    start: timestamp("start", { withTimezone: true }),
    stop: timestamp("stop", { withTimezone: true }),
    encounterClass: text("encounter_class"),
    code: text("code"),
    codeSystem: text("code_system"),
    description: text("description"),
    reasonCode: text("reason_code"),
    reasonDescription: text("reason_description"),
  },
  (table) => [
    index("synthea_encounters_patient_idx").on(table.patientId),
    index("synthea_encounters_class_idx").on(table.encounterClass),
  ]
);

export type SyntheaEncounter = typeof syntheaEncounters.$inferSelect;

/** FHIR AllergyIntolerance klinik projeksiyonu; ham alerji notu saklanmaz. */
export const syntheaAllergies = pgTable(
  "synthea_allergies",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: text("source_id").notNull().unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    start: timestamp("start", { withTimezone: true }),
    stop: timestamp("stop", { withTimezone: true }),
    code: text("code"),
    codeSystem: text("code_system"),
    description: text("description"),
    category: text("category"),
    clinicalStatus: text("clinical_status"),
    verificationStatus: text("verification_status"),
  },
  (table) => [index("synthea_allergies_patient_idx").on(table.patientId)]
);

export type SyntheaAllergy = typeof syntheaAllergies.$inferSelect;

/** FHIR Immunization klinik projeksiyonu. */
export const syntheaImmunizations = pgTable(
  "synthea_immunizations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: text("source_id").notNull().unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    date: timestamp("date", { withTimezone: true }),
    code: text("code"),
    codeSystem: text("code_system"),
    description: text("description"),
    status: text("status"),
  },
  (table) => [index("synthea_immunizations_patient_idx").on(table.patientId)]
);

export type SyntheaImmunization = typeof syntheaImmunizations.$inferSelect;

/** FHIR CarePlan klinik projeksiyonu. */
export const syntheaCarePlans = pgTable(
  "synthea_care_plans",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: text("source_id").notNull().unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    start: timestamp("start", { withTimezone: true }),
    stop: timestamp("stop", { withTimezone: true }),
    category: text("category"),
    code: text("code"),
    codeSystem: text("code_system"),
    description: text("description"),
    status: text("status"),
  },
  (table) => [index("synthea_care_plans_patient_idx").on(table.patientId)]
);

export type SyntheaCarePlan = typeof syntheaCarePlans.$inferSelect;

/** FHIR DiagnosticReport klinik projeksiyonu; gözlem sonuçları ayrı Observation tablosundadır. */
export const syntheaDiagnosticReports = pgTable(
  "synthea_diagnostic_reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: text("source_id").notNull().unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    date: timestamp("date", { withTimezone: true }),
    code: text("code"),
    codeSystem: text("code_system"),
    description: text("description"),
    status: text("status"),
  },
  (table) => [index("synthea_diagnostic_reports_patient_idx").on(table.patientId)]
);

export type SyntheaDiagnosticReport = typeof syntheaDiagnosticReports.$inferSelect;

/** Ham FHIR dosyası için DB-dışı, değişmez kaynak manifesti. */
export const fhirSourceArchives = pgTable("fhir_source_archives", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceUri: text("source_uri").notNull(),
  sourceFormat: text("source_format").notNull(),
  fhirVersion: text("fhir_version"),
  fileCount: integer("file_count").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  manifestHash: text("manifest_hash").notNull().unique(),
  rawPayloadRetainedInDb: boolean("raw_payload_retained_in_db").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fhirImportRuns = pgTable(
  "fhir_import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    archiveId: uuid("archive_id").notNull().references(() => fhirSourceArchives.id, { onDelete: "restrict" }),
    mode: text("mode").notNull(),
    files: integer("files").notNull(),
    invalidFiles: integer("invalid_files").notNull(),
    resourceTypes: jsonb("resource_types").$type<Record<string, number>>().notNull(),
    importedCounts: jsonb("imported_counts").$type<Record<string, number>>().notNull(),
    unsupported: jsonb("unsupported").$type<Record<string, number>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("fhir_import_runs_archive_created_idx").on(table.archiveId, table.createdAt)]
);

/** Eğitim vakasının sentetik kaynak hastaya sunucu içi eşlemesi. */
export const syntheaCaseSources = pgTable(
  "synthea_case_sources",
  {
    caseId: text("case_id")
      .primaryKey()
      .references(() => clinicalCases.caseId, { onDelete: "cascade" }),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("synthea"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("synthea_case_sources_patient_idx").on(table.patientId)]
);

export type SyntheaCaseSource = typeof syntheaCaseSources.$inferSelect;

/**
 * Göğüs röntgeni (NIH ChestX-ray14) kaynağı. Sentetik vakayı, bulgu etiketi +
 * yaş + cinsiyet üzerinden deterministik eşleştirilmiş gerçek bir CXR
 * görüntüsüne bağlar. Ham görüntü DB'de tutulmaz; yalnızca dosya indeksi.
 */
export const radiologySources = pgTable(
  "radiology_sources",
  {
    caseId: text("case_id")
      .primaryKey()
      .references(() => clinicalCases.caseId, { onDelete: "cascade" }),
    /** ChestX-ray14 görüntü dosyası adı (örn. "00000001_000.png"). */
    imageIndex: text("image_index").notNull(),
    /** Eşleşen bulgu etiketi (örn. "Pneumonia", "Emphysema", "Mass"). */
    findingLabel: text("finding_label").notNull(),
    source: text("source").notNull().default("chestxray14"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("radiology_sources_image_idx").on(table.imageIndex)]
);

export type RadiologySource = typeof radiologySources.$inferSelect;

/**
 * EKG kaynağı (PTB-XL). Sentetik vakayı, tanı (SCP kodu) + yaş + cinsiyet
 * üzerinden deterministik eşleştirilmiş gerçek bir 12-derivasyonlu EKG
 * kaydına bağlar. Ham sinyal DB'de tutulmaz; render edilmiş PNG dosya indeksi.
 *
 * Not: case_id, clinical_cases'a FK bağlamaz — EKG vakaları (kardiyoloji::stemi
 * vb.) JSON case store'da yaşar; clinical_cases yalnızca synthea üretimi vakaları
 * içerir. FK olsaydı JSON store vakalarına eşleme kırılırdı.
 */
export const ekgSources = pgTable(
  "ekg_sources",
  {
    caseId: text("case_id").primaryKey(),
    /** PTB-XL kayıt kimliği (örn. 10001). */
    ecgId: integer("ecg_id").notNull(),
    /** Render edilmiş EKG görüntüsü dosya adı (örn. "00001.png"). */
    imageIndex: text("image_index").notNull(),
    /** Kayıttaki aktif SCP tanı kodları (örn. {"IMI":100}). */
    scpCodes: jsonb("scp_codes"),
    /** Eşleşen bulgu etiketi (örn. "İnferior miyokard infarktüsü"). */
    findingLabel: text("finding_label").notNull(),
    source: text("source").notNull().default("ptbxl"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ekg_sources_image_idx").on(table.imageIndex)]
);

export type EkgSource = typeof ekgSources.$inferSelect;

/** Kullanıcı talebiyle açılan klinik geçmiş görünümünün asgari erişim denetimi. */
export const syntheaHistoryAccessAudit = pgTable(
  "synthea_history_access_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: text("case_id")
      .notNull()
      .references(() => clinicalCases.caseId, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("synthea_history_access_audit_case_created_idx").on(table.caseId, table.createdAt)]
);

export type SyntheaHistoryAccessAudit = typeof syntheaHistoryAccessAudit.$inferSelect;

export const syntheaImagingStudies = pgTable(
  "synthea_imaging_studies",
  {
    /** Kaynak Id benzersiz değildir (seri/instance tekrarı); surrogate PK kullanılır. */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => syntheaPatients.id, { onDelete: "cascade" }),
    encounterId: text("encounter_id"),
    date: timestamp("date", { withTimezone: true }),
    bodySiteCode: text("bodysite_code"),
    bodySiteDescription: text("bodysite_description"),
    modalityCode: text("modality_code"),
    modalityDescription: text("modality_description"),
    procedureCode: text("procedure_code"),
  },
  (table) => [index("synthea_imaging_studies_patient_idx").on(table.patientId)]
);

export type SyntheaImagingStudy = typeof syntheaImagingStudies.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// Independent medical-image catalogue.
//
// These tables intentionally have no relation to clinical_cases,
// learning_attempts, radiology_sources, ekg_sources, or synthea_*.  They index
// source dataset records directly for the separate image-analysis workspace.
// ═══════════════════════════════════════════════════════════════════════════

export const imagingDatasets = pgTable(
  "imaging_datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetKey: text("dataset_key").notNull(),
    version: text("version").notNull(),
    displayName: text("display_name").notNull(),
    modality: text("modality").notNull(),
    sourceUri: text("source_uri"),
    attributionUri: text("attribution_uri"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("imaging_datasets_key_version_unique").on(table.datasetKey, table.version),
    index("imaging_datasets_modality_published_idx").on(table.modality, table.publishedAt),
  ]
);

export const imagingDatasetDocuments = pgTable(
  "imaging_dataset_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => imagingDatasets.id, { onDelete: "restrict" }),
    documentKind: text("document_kind").notNull(),
    /** Importer-only relative storage key; never streamed to student routes. */
    storageKey: text("storage_key").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    mimeType: text("mime_type").notNull(),
    title: text("title"),
    attribution: text("attribution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("imaging_dataset_documents_dataset_storage_unique").on(table.datasetId, table.storageKey),
    index("imaging_dataset_documents_dataset_kind_idx").on(table.datasetId, table.documentKind),
  ]
);

export const imagingImportRuns = pgTable(
  "imaging_import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => imagingDatasets.id, { onDelete: "restrict" }),
    status: imagingImportRunStatus("status").notNull().default("running"),
    manifestChecksum: text("manifest_checksum").notNull(),
    metadataChecksum: text("metadata_checksum").notNull(),
    /** Version only; material never enters the database. */
    hmacKeyVersion: text("hmac_key_version"),
    discoveredCounts: jsonb("discovered_counts").$type<Record<string, number>>().notNull().default({}),
    importedCounts: jsonb("imported_counts").$type<Record<string, number>>().notNull().default({}),
    errorSummary: jsonb("error_summary").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("imaging_import_runs_dataset_status_started_idx").on(table.datasetId, table.status, table.startedAt),
    index("imaging_import_runs_dataset_manifest_idx").on(table.datasetId, table.manifestChecksum),
  ]
);

export const imagingRenderRuns = pgTable(
  "imaging_render_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => imagingDatasets.id, { onDelete: "restrict" }),
    importRunId: uuid("import_run_id")
      .notNull()
      .references(() => imagingImportRuns.id, { onDelete: "restrict" }),
    status: imagingRenderRunStatus("status").notNull().default("running"),
    rendererVersion: text("renderer_version").notNull(),
    renderProfile: text("render_profile").notNull(),
    cursor: text("cursor"),
    discoveredCount: integer("discovered_count").notNull().default(0),
    renderedCount: integer("rendered_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    errorSummary: jsonb("error_summary").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("imaging_render_runs_dataset_status_started_idx").on(table.datasetId, table.status, table.startedAt),
    index("imaging_render_runs_import_run_idx").on(table.importRunId),
  ]
);

export const imagingRecords = pgTable(
  "imaging_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => imagingDatasets.id, { onDelete: "restrict" }),
    importRunId: uuid("import_run_id")
      .notNull()
      .references(() => imagingImportRuns.id, { onDelete: "restrict" }),
    sourceRecordId: text("source_record_id").notNull(),
    /** HMAC-derived, versioned server-internal repeat-exposure key only. */
    sourceSubjectKey: text("source_subject_key"),
    modality: text("modality").notNull(),
    sourceAge: integer("source_age"),
    sourceSex: text("source_sex"),
    viewPosition: text("view_position"),
    protocol: text("protocol"),
    metadataChecksum: text("metadata_checksum").notNull(),
    availability: imagingRecordAvailability("availability").notNull().default("indexed"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("imaging_records_dataset_source_record_unique").on(table.datasetId, table.sourceRecordId),
    index("imaging_records_catalog_idx").on(table.modality, table.availability, table.publishedAt),
    index("imaging_records_dataset_import_idx").on(table.datasetId, table.importRunId),
    index("imaging_records_subject_key_idx").on(table.datasetId, table.sourceSubjectKey),
  ]
);

export const imagingRecordAssets = pgTable(
  "imaging_record_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => imagingRecords.id, { onDelete: "cascade" }),
    renderRunId: uuid("render_run_id").references(() => imagingRenderRuns.id, { onDelete: "set null" }),
    assetRole: text("asset_role").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    width: integer("width"),
    height: integer("height"),
    samplingRateHz: doublePrecision("sampling_rate_hz"),
    rendererVersion: text("renderer_version").notNull(),
    renderProfile: text("render_profile").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("imaging_record_assets_version_unique").on(
      table.recordId,
      table.assetRole,
      table.rendererVersion,
      table.renderProfile
    ),
    uniqueIndex("imaging_record_assets_one_published_display_image_unique")
      .on(table.recordId)
      .where(sql`${table.assetRole} = 'display_image' AND ${table.publishedAt} IS NOT NULL`),
    index("imaging_record_assets_record_role_published_idx").on(table.recordId, table.assetRole, table.publishedAt),
  ]
);

export const imagingRecordLabels = pgTable(
  "imaging_record_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => imagingRecords.id, { onDelete: "cascade" }),
    sourceLabelKey: text("source_label_key").notNull(),
    sourceLabelCode: text("source_label_code"),
    sourceLabelName: text("source_label_name").notNull(),
    category: text("category"),
    isPrimary: boolean("is_primary").notNull().default(false),
    provenance: text("provenance").notNull(),
    confidence: doublePrecision("confidence"),
    sourceValue: jsonb("source_value").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("imaging_record_labels_record_source_key_unique").on(table.recordId, table.sourceLabelKey),
    index("imaging_record_labels_record_primary_idx").on(table.recordId, table.isPrimary),
  ]
);

export const imagingAnswerTaxonomies = pgTable(
  "imaging_answer_taxonomies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modality: text("modality").notNull(),
    version: text("version").notNull(),
    status: imagingTaxonomyStatus("status").notNull().default("draft"),
    displayName: text("display_name").notNull(),
    description: text("description"),
    scoringVersion: text("scoring_version").notNull().default("v1"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("imaging_answer_taxonomies_modality_version_unique").on(table.modality, table.version),
    index("imaging_answer_taxonomies_modality_status_idx").on(table.modality, table.status, table.publishedAt),
  ]
);

export const imagingAnswerOptions = pgTable(
  "imaging_answer_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taxonomyId: uuid("taxonomy_id")
      .notNull()
      .references(() => imagingAnswerTaxonomies.id, { onDelete: "cascade" }),
    optionKey: text("option_key").notNull(),
    displayLabel: text("display_label").notNull(),
    category: text("category"),
    /** Server-side mapping only; pre-submit responses never include it. */
    sourceLabelMapping: jsonb("source_label_mapping").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("imaging_answer_options_taxonomy_option_key_unique").on(table.taxonomyId, table.optionKey),
    index("imaging_answer_options_taxonomy_active_order_idx").on(table.taxonomyId, table.active, table.sortOrder),
  ]
);

export const imagingAttempts = pgTable(
  "imaging_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recordId: uuid("record_id")
      .notNull()
      .references(() => imagingRecords.id, { onDelete: "restrict" }),
    taxonomyId: uuid("taxonomy_id")
      .notNull()
      .references(() => imagingAnswerTaxonomies.id, { onDelete: "restrict" }),
    status: imagingAttemptStatus("status").notNull().default("active"),
    /** Labels-free snapshot; immutable evaluation is populated only on submit. */
    recordSnapshot: jsonb("record_snapshot").notNull(),
    evaluationSnapshot: jsonb("evaluation_snapshot"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("imaging_attempts_student_status_updated_idx").on(table.studentId, table.status, table.updatedAt),
    index("imaging_attempts_student_record_idx").on(table.studentId, table.recordId),
  ]
);

export const imagingInterpretations = pgTable(
  "imaging_interpretations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => imagingAttempts.id, { onDelete: "cascade" })
      .unique(),
    selectedOptionKeys: jsonb("selected_option_keys").$type<string[]>().notNull(),
    likelyDiagnosis: text("likely_diagnosis"),
    structuredObservations: jsonb("structured_observations").notNull(),
    freeText: text("free_text"),
    score: doublePrecision("score"),
    feedback: jsonb("feedback").$type<Record<string, unknown>>(),
    evaluationVersion: text("evaluation_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("imaging_interpretations_created_idx").on(table.createdAt)]
);

export type ImagingDataset = typeof imagingDatasets.$inferSelect;
export type ImagingRecord = typeof imagingRecords.$inferSelect;
export type ImagingAttempt = typeof imagingAttempts.$inferSelect;
export type ImagingInterpretation = typeof imagingInterpretations.$inferSelect;
