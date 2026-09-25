import type { VoiceProvider, VoiceCallRequest, VoiceCallResult } from "./types";

// Mock provider — does not place a real call. Returns "ringing" so the admin
// simulator can drive the DTMF callback flow end-to-end.
export const mockVoiceProvider: VoiceProvider = {
  name: "mock",
  async placeCall(_req: VoiceCallRequest): Promise<VoiceCallResult> {
    return { status: "ringing", providerCallId: `mock_${Date.now()}` };
  },
};
