import type { VoiceProvider } from "./types";
import { mockVoiceProvider } from "./mock";

export type { VoiceProvider, VoiceCallRequest, VoiceCallResult } from "./types";

export function getVoiceProvider(name: string = "mock"): VoiceProvider {
  switch (name) {
    case "mock":
    default:
      return mockVoiceProvider;
  }
}
