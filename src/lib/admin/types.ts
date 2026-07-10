import { Rubric, Seviye, TestSonucu, Cinsiyet } from "../types";

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
  hastaYanitlari: Record<string, string>;
  idealYol: string[];
  egitimNotu: string;
  updatedAt: number;
  createdAt: number;
}

export interface CasesStore {
  version: number;
  seededAt: number;
  updatedAt: number;
  changeCount: number; // yedek tetikleyici (her 10)
  cases: AdminVaka[];
}

export type AuditAction =
  | "update_test_field"
  | "update_test"
  | "add_test"
  | "delete_test"
  | "create_case"
  | "update_case"
  | "delete_case"
  | "create_backup"
  | "restore_backup"
  | "undo"
  | "seed";

/** Tek bir alan/patch değişikliği — seçici geri alma için */
export interface AuditPatch {
  path: string; // örn. cases[id].statikTestler.TROPONIN.sonuc.deger
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
  undone: boolean;
  undoOf?: string; // bu log bir undo ise hedef log id
  undoneBy?: string; // bu log undo edildiyse undo log id
}

export interface LogsStore {
  version: number;
  logs: AuditLog[];
}

export interface BackupMeta {
  id: string;
  timestamp: number;
  reason: string; // "auto-every-10" | "manual" | "pre-restore"
  changeCountAtBackup: number;
  caseCount: number;
  filename: string;
}

export interface BackupsIndex {
  version: number;
  backups: BackupMeta[];
}

export interface AdminSessionPayload {
  username: string;
  exp: number;
}
