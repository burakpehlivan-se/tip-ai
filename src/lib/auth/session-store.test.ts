import { describe, expect, it } from "vitest";
import { sessionExpiresAt } from "./session-store";

describe("merkezi oturum süre hesabı", () => {
  it("oturum bitişini verilen TTL kadar ileri alır", () => {
    expect(sessionExpiresAt(new Date(1_000), 12_000).getTime()).toBe(13_000);
  });
});
