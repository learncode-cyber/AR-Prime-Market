import { geminiProvider, isGeminiConfigured, DEFAULT_GEMINI_MODEL } from "@/lib/gemini.server";
import type { AIProviderPlugin } from "../types";

/**
 * Wraps the existing `gemini.server.ts` (untouched — this is an adapter,
 * not a rewrite) as the first concrete `AIProviderPlugin`. Registered as
 * the default provider in `aiProviderRegistry` (see ../index.ts) since it's
 * the only provider currently in production use — this changes nothing
 * about current behavior, it just gives every call site the option to go
 * through the registry instead of importing `gemini.server.ts` directly.
 */
export const geminiPlugin: AIProviderPlugin = {
  id: "gemini",
  name: "Google Gemini",
  async isConfigured(surface?: string): Promise<boolean> {
    return isGeminiConfigured(surface);
  },
  async getLanguageModel(model?: string, surface?: string): Promise<unknown> {
    return geminiProvider(model ?? DEFAULT_GEMINI_MODEL, surface);
  },
};
