import { Rubric, Seviye, TestSonucu } from "../types";
import { KisilikTipiKey } from "../ai/kisilik-tipleri";

export type VakaDurum = "taslak" | "aktif" | "arsiv";
export type VakaIncelemeDurumu = "taslak" | "incelemede" | "onayli" | "degisiklik_istendi" | "legacy";

export type VakaEtiket =
  | "OSCE"
  | "Acil"
  | "Poliklinik"
  | "Düşük seviye"
  | "Orta seviye"
  | "İleri seviye"
  | "Kardiyoloji"
  | "Diğer";

/** OMOP condition_occurrence benzeri (TIP-AI CDM v1) */
export interface AdminCondition {
  code: string;
  ad: string;
  system?: "local" | "icd9" | "icd10" | "snomed" | "atc" | "loinc";
  primary?: boolean;
}

/** Hasta profil uzantısı */
export interface AdminPatientProfil {
  bmi?: number;
  sigara?: string;
  komorbiditeler?: string[];
}

export interface AdminVitals {
  tansiyon?: string;
  nabiz?: number;
  ates?: number;
  spo2?: number;
  solunum?: number;
}

export interface AdminTedavi {
  ilaclar?: Array<{
    code?: string;
    ad: string;
    doz: string;
    yol: string;
    siklik?: string;
    sure?: string;
    endikasyon: string;
  }>;
  prosedurler?: string[];
  onemliNotlar?: string[];
  aciklama?: string;
}

/** Admin panelinde düzenlenen kalıcı vaka kaydı */
export interface AdminVaka {
  id: string; // `${poliklinikKey}::${hastalikKey}`
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  poliklinikAciklama: string;
  hastalikKey: string;
  hastalikAdi: string;
  seviye: Seviye;
  yasAraligi: [number, number];
  cinsiyetTercih: "E" | "K" | "herhangi";
  anaSikayet: string;
  ozetBilgiler: string[];
  semptomSablon: string;
  rubric: Rubric;
  statikTestler: Record<string, TestSonucu>;
  /** Pipeline (lab motoru) tarafından üretilip kalıcılaştırılan sonuçlar */
  generatedTests?: Record<string, TestSonucu>;
  /** Vaka özel override'lar — sadece referans kütüphanesinden sapan testler (CDM v2) */
  testOverrides?: Record<string, TestSonucu>;
  hastaYanitlari: Record<string, string>;
  idealYol: string[];
  egitimNotu: string;
  /** Yayın durumu — taslak öğrenciye açılmaz */
  durum: VakaDurum;
  /** Filtre etiketleri */
  etiketler: string[];
  /** Sürüm numarası */
  surum: number;
  /** Uzman onayı */
  uzmanOnayi: boolean;
  uzmanOnaylayan?: string;
  uzmanOnayTarihi?: number;
  /** Reviewer onayladığında klinik içerik/rubrik kimliği. */
  contentChecksum?: string;
  /** Yeni vaka ve düzenlemelerde iki aşamalı içerik review akışı. */
  incelemeDurumu?: VakaIncelemeDurumu;
  incelemeyeGonderen?: string;
  incelemeyeGonderilmeTarihi?: number;
  incelemeNotu?: string;
  /** Yayın için kaynak ve eğitim hedefi izlenebilirliği. */
  klinikKaynak?: string;
  klinikKaynakTarihi?: string;
  egitimHedefleri?: string[];
  sonKlinikGozdenGecirmeTarihi?: number;
  olusturan?: string;
  sonDuzenleyen?: string;
  updatedAt: number;
  createdAt: number;

  // ── TIP-AI CDM v1 uzantıları (OMOP + OSCE) ──
  /** Belge CDM şemasından geldiyse: tip-ai-cdm-v1 */
  cdmVersion?: string;
  patientProfil?: AdminPatientProfil;
  vitals?: AdminVitals;
  conditions?: AdminCondition[];
  tedavi?: AdminTedavi;
}

/**
 * Öğrencinin gördüğü ve reviewer'ın imzaladığı vaka içeriğinin değişmez kaydı.
 * Güncel vaka düzenlenebilir; yayınlanmış bir sürüm asla yerinde güncellenmez.
 */
export interface PublishedCaseVersion {
  /** `${caseId}@${version}`; aynı vaka sürümü ikinci kez yazılamaz. */
  id: string;
  caseId: string;
  version: number;
  contentChecksum: string;
  approvedBy: string;
  approvedAt: number;
  /** O anda yayınlanan tam vaka/rubrik gövdesi. */
  content: AdminVaka;
}

export interface CasesStore {
  version: number;
  seededAt: number;
  updatedAt: number;
  changeCount: number;
  cases: AdminVaka[];
  /** Append-only yayın sürümü kaydı; geçmiş denemelerin klinik bağlamını kanıtlar. */
  publishedVersions: PublishedCaseVersion[];
}

/** Yeniden kullanılabilir hasta şablonu — vaka oluştururken/düzenlerken uygulanır. */
export interface HastaTipi {
  /** ASCII slug (URL/anahtar) — ad'dan üretilir, benzersiz. */
  id: string;
  /** Görünen tip adı, örn. "Diyabetik Kadın". */
  ad: string;
  /** Örnekler / kullanım açıklaması. */
  aciklama?: string;
  yasAraligi: [number, number];
  cinsiyetTercih: "E" | "K" | "herhangi";
  /** Komorbidite / hastalık öyküsü listesi. */
  komorbiditeler: string[];
  /** AI cevap tonu (kod içi kişilik referansı). */
  kisilikTipi?: KisilikTipiKey;
  /** Hastanın nasıl konuşacağına dair kurallar (AI prompt girdisi). */
  konusmaKurallari?: string;
  /** Örnek konuşma cevapları (pozitif / negatif / belirsiz). */
  konusmaOrnekleri?: { pozitif: string; negatif: string; belirsiz: string };
  /** Serbest örnek konuşma cümleleri. */
  ornekCumleler?: string[];
  /** AI'nin ürettiği örnek hasta cevapları (soru anahtarı → cevap). */
  ornekCevaplar?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface HastaTipleriStore {
  version: number;
  /** İlk açılışta kişilik tipleri seed edilince dolar. */
  seededAt: number;
  updatedAt: number;
  tipler: HastaTipi[];
}

/** Vaka özelinde eğitmen / admin feedback’i (vaka değerleriyle birlikte) */
export interface VakaFeedback {
  id: string;
  caseId: string;
  hastalikKey: string;
  poliklinikKey: string;
  actor: string;
  /** Serbest metin feedback */
  metin: string;
  /** Debug oturumundan otomatik eklenen vaka anlık görüntüsü */
  vakaSnapshot?: {
    hastalikAdi?: string;
    anaSikayet?: string;
    seviye?: string;
    testKeys?: string[];
    beklenenTani?: string[];
    debugNotlar?: string;
  };
  /** İsteğe bağlı puan / debug sonucu */
  debugPuan?: {
    toplamPuan?: number;
    maxPuan?: number;
    taniGirildi?: string;
    taniDogru?: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackStore {
  version: number;
  feedbacks: VakaFeedback[];
}

/** Çemiçgezek / sistem ayarları */
export interface CemicegekAyarlari {
  kalabaliklik: "az" | "orta" | "cok";
  /** Lab sonrası kaç hasta sonra geri gelsin (sabit veya min-max) */
  geriDonusMin: number;
  geriDonusMax: number;
  /** Boş = tüm poliklinikler */
  aktifPoliklinikler: string[];
  /** Boş = tüm aktif vakalar */
  aktifHastaliklar: string[];
}

export interface AiAyarlari {
  /** Serbest metin sorular için Gemini eşleştirme fallback'i. */
  eslestirme?: boolean;
}

export interface SystemSettings {
  version: number;
  updatedAt: number;
  cemicegek: CemicegekAyarlari;
  ai?: AiAyarlari;
}

/** Öğrenci / admin play oturum özeti (analitik) */
export interface PlaySession {
  id: string;
  caseId: string;
  hastalikKey: string;
  poliklinikKey: string;
  actor: string;
  mode: "ogrenci" | "admin-debug";
  toplamPuan: number;
  maxPuan: number;
  taniDogru: boolean;
  atlananRedFlagler: string[];
  gereksizTestler: string[];
  eksikSorular: string[];
  eksikTestler: string[];
  anamnezCoverage?: number;
  /** Serbest metin değil, yalnızca öğrenme eğilimi için türetilmiş özet metrikler. */
  clinicalReasoningRecorded?: boolean;
  differentialCount?: number;
  clinicalConfidence?: number;
  confidenceCalibrationGap?: number;
  /** Denemenin başladığı kaynak vaka/rubrik sürümü; geçmiş değerlendirme izi için. */
  caseVersion?: number;
  caseChecksum?: string;
  createdAt: number;
}

export interface AnalyticsStore {
  version: number;
  sessions: PlaySession[];
}

export type AuditAction =
  | "update_test_field"
  | "update_test"
  | "add_test"
  | "delete_test"
  | "create_case"
  | "update_case"
  | "delete_case"
  | "submit_case_review"
  | "approve_case_review"
  | "request_case_changes"
  | "publish_case_version"
  | "create_backup"
  | "restore_backup"
  | "undo"
  | "seed"
  | "add_feedback"
  | "update_settings"
  | "play_session"
  | "import_cdm"
  | "create_user"
  | "update_user"
  | "delete_user"
  | "register_student"
  | "student_login"
  | "user_login"
  | "student_data_exported"
  | "student_privacy_request_submitted"
  | "student_privacy_request_resolved"
  | "admin_diagnostics_viewed";

export interface AuditPatch {
  path: string;
  caseId?: string;
  testKey?: string;
  field?: string;
  before: unknown;
  after: unknown;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  actor: string;
  action: AuditAction;
  message: string;
  patches: AuditPatch[];
  /** Olayın gösterim için gerekli, hassas olmayan bağlamı. */
  metadata?: Record<string, unknown>;
  undone: boolean;
  undoOf?: string;
  undoneBy?: string;
}

export interface LogsStore {
  version: number;
  logs: AuditLog[];
}

export interface BackupMeta {
  id: string;
  timestamp: number;
  reason: string;
  changeCountAtBackup: number;
  caseCount: number;
  filename: string;
  actor?: string;
}

export interface BackupsIndex {
  version: number;
  backups: BackupMeta[];
}

/** Panel rolleri — "ogrenci" öğrenci tarafı hesabıdır (panel erişimi yok) */
export type AdminRole = "admin" | "doktor" | "ogrenci";

export interface AdminUser {
  id: string;
  username: string;
  /** scrypt: saltHex:hashHex — düz şifre saklanmaz */
  passwordHash: string;
  role: AdminRole;
  displayName?: string;
  active: boolean;
  /**
   * Bootstrap süper admin (env admin / admin123).
   * Rol, aktiflik ve silme değiştirilemez.
   */
  superAdmin?: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface UsersStore {
  version: number;
  updatedAt: number;
  users: AdminUser[];
}

export interface SessionPayload {
  username: string;
  role: AdminRole;
  exp: number;
  userId?: string;
  /** PostgreSQL modunda sunucu tarafındaki iptal edilebilir oturum kaydı. */
  sessionId?: string;
}

export const DEFAULT_CEMICEGEK: CemicegekAyarlari = {
  kalabaliklik: "orta",
  geriDonusMin: 2,
  geriDonusMax: 3,
  aktifPoliklinikler: [],
  aktifHastaliklar: [],
};

export function normalizeAdminVaka(c: Partial<AdminVaka> & { id: string }): AdminVaka {
  const now = Date.now();
  return {
    id: c.id,
    poliklinikKey: c.poliklinikKey || "",
    poliklinikAd: c.poliklinikAd || "",
    poliklinikIcon: c.poliklinikIcon || "🏥",
    poliklinikAciklama: c.poliklinikAciklama || "",
    hastalikKey: c.hastalikKey || "",
    hastalikAdi: c.hastalikAdi || "",
    seviye: c.seviye || "orta",
    yasAraligi: c.yasAraligi || [30, 70],
    cinsiyetTercih: c.cinsiyetTercih || "herhangi",
    anaSikayet: c.anaSikayet || "",
    ozetBilgiler: c.ozetBilgiler || [],
    semptomSablon: c.semptomSablon || "",
    rubric: c.rubric || {
      beklenenSorular: [],
      beklenenTestler: [],
      gereksizTestler: [],
      redFlagler: [],
      kabulEdilenTani: [],
      puanlama: {},
    },
    statikTestler: c.statikTestler || {},
    generatedTests: c.generatedTests || {},
    testOverrides: c.testOverrides,
    hastaYanitlari: c.hastaYanitlari || {},
    idealYol: c.idealYol || [],
    egitimNotu: c.egitimNotu || "",
    durum: c.durum || "aktif",
    etiketler: c.etiketler || [],
    surum: c.surum ?? 1,
    uzmanOnayi: c.uzmanOnayi ?? false,
    uzmanOnaylayan: c.uzmanOnaylayan,
    uzmanOnayTarihi: c.uzmanOnayTarihi,
    contentChecksum: c.contentChecksum,
    incelemeDurumu:
      c.incelemeDurumu || (c.uzmanOnayi ? "onayli" : c.durum === "aktif" ? "legacy" : "taslak"),
    incelemeyeGonderen: c.incelemeyeGonderen,
    incelemeyeGonderilmeTarihi: c.incelemeyeGonderilmeTarihi,
    incelemeNotu: c.incelemeNotu,
    klinikKaynak: c.klinikKaynak,
    klinikKaynakTarihi: c.klinikKaynakTarihi,
    egitimHedefleri: c.egitimHedefleri || [],
    sonKlinikGozdenGecirmeTarihi: c.sonKlinikGozdenGecirmeTarihi,
    olusturan: c.olusturan,
    sonDuzenleyen: c.sonDuzenleyen,
    updatedAt: c.updatedAt || now,
    createdAt: c.createdAt || now,
    cdmVersion: c.cdmVersion,
    patientProfil: c.patientProfil,
    vitals: c.vitals,
    conditions: c.conditions,
    tedavi: c.tedavi,
  };
}
