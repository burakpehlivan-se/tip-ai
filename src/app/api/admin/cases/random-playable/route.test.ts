import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runtimeStore = vi.hoisted(() => ({ loadRuntimeCasesStore: vi.fn() }));
const legacyStore = vi.hoisted(() => ({ loadCasesStore: vi.fn() }));

vi.mock("@/lib/admin/auth", () => ({
  getSessionFromRequest: vi.fn(async () => ({ username: "admin", role: "admin" })),
}));
vi.mock("@/lib/admin/permissions", () => ({
  requirePermission: vi.fn(() => null),
}));
vi.mock("@/lib/admin/runtime-case-store", () => runtimeStore);
vi.mock("@/lib/admin/store", () => legacyStore);
vi.mock("@/lib/admin/case-to-vaka", () => ({
  adminVakaToPlayable: vi.fn((vaka: { id: string }) => ({ sourceCaseId: vaka.id })),
}));

import { GET } from "./route";

describe("admin random playable case route", () => {
  it("uses the runtime case store instead of the legacy JSON store", async () => {
    const activeCase = { id: "solunum::pnömoni", durum: "aktif" };
    runtimeStore.loadRuntimeCasesStore.mockResolvedValue({ cases: [activeCase] });
    legacyStore.loadCasesStore.mockReturnValue({ cases: [] });

    const response = await GET(new NextRequest("http://localhost/api/admin/cases/random-playable"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: activeCase.id });
    expect(runtimeStore.loadRuntimeCasesStore).toHaveBeenCalledOnce();
    expect(legacyStore.loadCasesStore).not.toHaveBeenCalled();
  });
});
