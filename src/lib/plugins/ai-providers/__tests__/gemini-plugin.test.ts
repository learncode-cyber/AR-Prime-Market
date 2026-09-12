import { describe, it, expect, vi, beforeEach } from "vitest";

const isGeminiConfiguredMock = vi.fn();
const geminiProviderMock = vi.fn();

vi.mock("@/lib/gemini.server", () => ({
  isGeminiConfigured: (...args: unknown[]) => isGeminiConfiguredMock(...args),
  geminiProvider: (...args: unknown[]) => geminiProviderMock(...args),
  DEFAULT_GEMINI_MODEL: "gemini-2.5-flash",
}));

import { geminiPlugin } from "@/lib/plugins/ai-providers/gemini-plugin";

describe("geminiPlugin", () => {
  beforeEach(() => {
    isGeminiConfiguredMock.mockReset();
    geminiProviderMock.mockReset();
  });

  it("has the expected id and name", () => {
    expect(geminiPlugin.id).toBe("gemini");
    expect(geminiPlugin.name).toBe("Google Gemini");
  });

  it("isConfigured delegates to isGeminiConfigured with the surface", async () => {
    isGeminiConfiguredMock.mockResolvedValue(true);
    await expect(geminiPlugin.isConfigured("chat")).resolves.toBe(true);
    expect(isGeminiConfiguredMock).toHaveBeenCalledWith("chat");
  });

  it("getLanguageModel delegates to geminiProvider with default model when omitted", async () => {
    geminiProviderMock.mockResolvedValue({ fake: "model" });
    const result = await geminiPlugin.getLanguageModel(undefined, "blog");
    expect(geminiProviderMock).toHaveBeenCalledWith("gemini-2.5-flash", "blog");
    expect(result).toEqual({ fake: "model" });
  });

  it("getLanguageModel passes through an explicit model name", async () => {
    geminiProviderMock.mockResolvedValue({ fake: "model2" });
    await geminiPlugin.getLanguageModel("gemini-2.5-pro", "shopping");
    expect(geminiProviderMock).toHaveBeenCalledWith("gemini-2.5-pro", "shopping");
  });
});
