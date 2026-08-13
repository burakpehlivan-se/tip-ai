import { describe, expect, it } from "vitest";
import { createCdmImportConfirmation, verifyCdmImportConfirmation } from "./import-confirmation";

const binding = {
  actor: "Reviewer",
  overwrite: false,
  storeUpdatedAt: 1_700_000_000_000,
  documents: [
    { id: "dahiliye::kbh", checksum: "a".repeat(64) },
    { id: "kardiyoloji::stemi", checksum: "b".repeat(64) },
  ],
};

describe("CDM import confirmation", () => {
  it("accepts the exact dry-run plan for the same actor", () => {
    const now = 1_700_000_000_000;
    const confirmation = createCdmImportConfirmation(binding, now);
    expect(verifyCdmImportConfirmation(confirmation.token, binding, now + 1)).toBe(true);
  });

  it("rejects a stale, altered, or cross-user plan", () => {
    const now = 1_700_000_000_000;
    const confirmation = createCdmImportConfirmation(binding, now);
    expect(verifyCdmImportConfirmation(confirmation.token, { ...binding, actor: "another-reviewer" }, now + 1)).toBe(false);
    expect(verifyCdmImportConfirmation(confirmation.token, { ...binding, storeUpdatedAt: binding.storeUpdatedAt + 1 }, now + 1)).toBe(false);
    expect(verifyCdmImportConfirmation(confirmation.token, { ...binding, overwrite: true }, now + 1)).toBe(false);
    expect(verifyCdmImportConfirmation(confirmation.token, binding, confirmation.expiresAt + 1)).toBe(false);
    expect(verifyCdmImportConfirmation(`${confirmation.token}tampered`, binding, now + 1)).toBe(false);
  });
});
