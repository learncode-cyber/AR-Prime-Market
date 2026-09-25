// Voice provider abstraction. Swap mock for Twilio/Vapi by implementing this.
export interface VoiceCallRequest {
  orderId: string;
  phone: string | null;
  customerName: string | null;
  script: string;
}

export interface VoiceCallResult {
  status: "ringing" | "answered" | "confirmed" | "cancelled" | "no_response" | "failed";
  providerCallId?: string;
  error?: string;
}

export interface VoiceProvider {
  readonly name: string;
  placeCall(req: VoiceCallRequest): Promise<VoiceCallResult>;
}
