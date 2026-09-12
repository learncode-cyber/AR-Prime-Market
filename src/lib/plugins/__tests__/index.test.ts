import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/gemini.server", () => ({
  isGeminiConfigured: () => true,
  geminiProvider: () => ({ fake: "model" }),
  DEFAULT_GEMINI_MODEL: "gemini-2.5-flash",
}));

import { aiProviderRegistry, supplierRegistry, paymentRegistry, geminiPlugin } from "@/lib/plugins";

describe("aiProviderRegistry (pre-populated)", () => {
  it("has gemini registered by default", () => {
    expect(aiProviderRegistry.has("gemini")).toBe(true);
    expect(aiProviderRegistry.get("gemini")).toBe(geminiPlugin);
  });

  it("gemini is the default provider", () => {
    expect(aiProviderRegistry.getDefault()?.id).toBe("gemini");
  });
});

describe("supplierRegistry and paymentRegistry (empty scaffolds)", () => {
  it("start empty, ready for future adapters", () => {
    expect(supplierRegistry.list()).toEqual([]);
    expect(paymentRegistry.list()).toEqual([]);
  });
});
