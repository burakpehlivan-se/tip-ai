import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-rule-engine-test-"));
const oldCwd = process.cwd();

describe("rule engine store", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("kural ve alias yaşam döngüsünü kalıcı olarak yönetir", async () => {
    const store = await import("./rule-engine-store");
    const defaultCount = store.loadRuleEngineStore().rules.length;

    const rule = store.addRule({
      testKey: "TEST_KURAL",
      diseaseKey: "test-hastalik",
      tendency: "yuksek",
      factor: 2,
      description: "Test kuralı",
      active: true,
    });
    expect(store.getActiveRules()).toContainEqual({
      testKey: "TEST_KURAL",
      diseaseKey: "test-hastalik",
      tendency: "yuksek",
      factor: 2,
    });

    expect(store.updateRule(rule.id, { active: false, factor: 3 }).factor).toBe(3);
    expect(store.getActiveRules().some((entry) => entry.testKey === "TEST_KURAL")).toBe(false);

    expect(store.updateRule(rule.id, { active: true }).factor).toBe(3);
    expect(store.updateRule(rule.id, { active: true }).description).toBe("Test kuralı");
    expect(store.updateRule(rule.id, { active: true }).tendency).toBe("yuksek");

    store.addAlias({ alias: "test-alias", target: "test-hastalik" });
    expect(store.getActiveAliases()["test-alias"]).toBe("test-hastalik");
    store.deleteAlias("test-alias");
    store.deleteRule(rule.id);

    const reset = store.resetToDefaults();
    expect(reset.rules).toHaveLength(defaultCount);
    expect(reset.rules.some((entry) => entry.id === rule.id)).toBe(false);
    expect(reset.aliases.some((entry) => entry.alias === "test-alias")).toBe(false);
  });

  it("bozuk kural dosyasını karantinaya alıp temiz varsayılanlara döner", async () => {
    const store = await import("./rule-engine-store");
    const rulesFile = path.join(tmpDir, "data", "admin", "rule-engine.json");
    fs.mkdirSync(path.dirname(rulesFile), { recursive: true });
    fs.writeFileSync(rulesFile, "{ bozuk-json", "utf8");
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const recovered = store.loadRuleEngineStore();
    const quarantined = fs
      .readdirSync(path.dirname(rulesFile))
      .find((file) => file.startsWith("rule-engine.json.corrupt-"));

    expect(recovered.rules.length).toBeGreaterThan(0);
    expect(quarantined).toBeDefined();
    expect(fs.readFileSync(path.join(path.dirname(rulesFile), quarantined!), "utf8")).toBe("{ bozuk-json");
    logSpy.mockRestore();
  });
});
