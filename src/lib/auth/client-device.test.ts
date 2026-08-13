import { describe, expect, it } from "vitest";
import { deviceLabelFromUserAgent } from "./client-device";

describe("gizlilik odaklı cihaz etiketi", () => {
  it("ham user-agent saklamak yerine kısa etiket üretir", () => {
    const raw = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
    const label = deviceLabelFromUserAgent(raw);
    expect(label).toBe("Safari · iOS");
    expect(label).not.toContain("Mozilla");
  });

  it("boş ve tanınmayan değerleri güvenli genelleştirir", () => {
    expect(deviceLabelFromUserAgent(null)).toBe("Bilinmeyen tarayıcı · Bilinmeyen cihaz");
    expect(deviceLabelFromUserAgent("custom-client/1.0")).toBe("Bilinmeyen tarayıcı · Bilinmeyen cihaz");
  });
});
