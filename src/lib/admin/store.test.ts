import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-store-test-"));
const oldCwd = process.cwd();

function seedCase(id: string) {
  return {
    id,
    poliklinikKey: "test",
    poliklinikAd: "Test Polikliniği",
    poliklinikIcon: "🏥",
    hastalikKey: "test-hastalik",
    hastalikAdi: "Test Hastalığı",
    seviye: "orta" as const,
    durum: "aktif" as const,
    anaSikayet: "Test şikayet",
    ozetBilgiler: [],
    rubric: {
      beklenenSorular: [],
      beklenenTestler: [],
      gereksizTestler: [],
      redFlagler: [],
      kabulEdilenTani: ["Test"],
      puanlama: {
        dogru_kritik_soru: 10,
        red_flag_atlama: -5,
        dogru_test: 15,
        gereksiz_test: -10,
        tani_dogru: 40,
        tani_yanlis: 0,
      },
    },
    statikTestler: {},
    hastaYanitlari: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("admin store (temp dir)", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
  });
  afterAll(() => {
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("boş depo ilk açılışta seed edilir", async () => {
    const { loadCasesStore } = await import("./store");
    const store = loadCasesStore();
    expect(store.cases.length).toBeGreaterThan(0);
    expect(store.seededAt).toBeGreaterThan(0);
  });

  it("recordMutation vaka ekler, changeCount ve audit log yazar", async () => {
    const { loadCasesStore, recordMutation, loadLogsStore } = await import("./store");
    const before = loadCasesStore().changeCount;
    const { store } = recordMutation(
      "test-actor",
      "create_case",
      "Test vaka eklendi",
      [],
      (s) => {
        s.cases.push(seedCase("vaka-1") as never);
      }
    );
    expect(store.changeCount).toBe(before + 1);
    expect(store.cases.some((c) => c.id === "vaka-1")).toBe(true);
    const logs = loadLogsStore().logs;
    expect(logs[0].action).toBe("create_case");
    expect(logs[0].actor).toBe("test-actor");
  });

  it("undoLog mutasyonu geri alır", async () => {
    const { loadCasesStore, recordMutation, undoLog } = await import("./store");
    const { log } = recordMutation(
      "test-actor",
      "update_case",
      "Tansiyon güncellendi",
      [
        {
          path: "cases.vaka-1.anaSikayet",
          caseId: "vaka-1",
          before: "Eski şikayet",
          after: "Yeni şikayet",
        },
      ],
      (s) => {
        const c = s.cases.find((x) => (x as { id?: string }).id === "vaka-1");
        if (c) (c as { anaSikayet?: string }).anaSikayet = "Yeni şikayet";
      }
    );
    const undone = await undoLog(log!.id, "test-actor");
    expect(undone.ok).toBe(true);
    const store = loadCasesStore();
    const c = store.cases.find((x) => (x as { id?: string }).id === "vaka-1");
    expect((c as { anaSikayet?: string }).anaSikayet).toBe("Eski şikayet");
  });

  it("yedekleme ve restore döngüsü çalışır", async () => {
    const { loadCasesStore, recordMutation, createBackup, restoreBackup, loadBackupsIndex } =
      await import("./store");
    const meta = createBackup("test", "test-actor");
    expect(meta.caseCount).toBeGreaterThan(0);
    expect(loadBackupsIndex().backups.length).toBeGreaterThan(0);

    const before = loadCasesStore().cases.length;
    recordMutation("test-actor", "delete_case", "Silme testi", [], (s) => {
      s.cases = s.cases.filter((c) => (c as { id?: string }).id !== "vaka-1");
    });
    expect(loadCasesStore().cases.length).toBe(before - 1);

    const restored = await restoreBackup(meta.id, "test-actor");
    expect(restored.ok).toBe(true);
    expect(loadCasesStore().cases.length).toBe(before);
  });

  it("withStoreLock görevleri sırayla seri çalıştırır", async () => {
    const { withStoreLock } = await import("./store");
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        withStoreLock(async () => {
          order.push(i);
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          order.push(i * 10);
        })
      )
    );
    expect(order).toEqual([1, 10, 2, 20, 3, 30, 4, 40, 5, 50]);
  });
});
