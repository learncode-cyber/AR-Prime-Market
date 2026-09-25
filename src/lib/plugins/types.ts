/**
 * Plugin System (Module 5) — core interface contracts.
 *
 * Scope note: this module ships a fully working, tested plugin
 * infrastructure and ONE concrete implementation (AIProviderPlugin, wrapping
 * the existing Gemini integration — see ./ai-providers/gemini-plugin.ts).
 *
 * SupplierPlugin and PaymentPlugin are defined here as CONTRACTS ONLY. Real
 * supplier (CJ Dropshipping, AliExpress, Spocket) and payment (bKash,
 * Binance Pay) integrations currently live as Supabase Edge Functions
 * (Deno runtime) handling live money and live supplier orders. Wrapping
 * them behind this interface requires refactoring that Deno code — real
 * production financial/supplier flows — which this sandbox has no way to
 * integration-test against a staging environment. Doing that blind is
 * exactly the kind of risk the "never remove existing features, refactor
 * only when necessary" rule warns against. See
 * docs/architecture/PLUGIN_SYSTEM.md for the concrete migration plan.
 */

// ---------------------------------------------------------------------------
// AI Provider plugin — implemented in this module (see ai-providers/gemini-plugin.ts)
// ---------------------------------------------------------------------------

export interface AIProviderPlugin {
  /** Stable, unique identifier — e.g. "gemini", "openai", "claude". */
  readonly id: string;
  readonly name: string;
  /** Whether this provider has the credentials it needs for the given surface. */
  isConfigured(surface?: string): Promise<boolean>;
  /**
   * Returns an AI SDK-compatible language model instance for the given
   * surface/model. Kept intentionally loose-typed (not importing the full
   * `ai` SDK's LanguageModel type here) so this contract file has zero
   * runtime dependencies — implementations import what they need.
   */
  getLanguageModel(model?: string, surface?: string): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Supplier plugin — CONTRACT ONLY (see scope note above)
// ---------------------------------------------------------------------------

export interface SupplierProduct {
  sourceProductId: string;
  title: string;
  priceUsd: number;
  stockQuantity: number;
  imageUrls: string[];
}

export interface SupplierPlugin {
  readonly id: string; // e.g. "cj-dropshipping", "aliexpress", "spocket"
  readonly name: string;
  isConfigured(): boolean;
  fetchProduct(sourceProductId: string): Promise<SupplierProduct | null>;
  fetchStock(sourceProductId: string): Promise<number | null>;
}

// ---------------------------------------------------------------------------
// Payment plugin — CONTRACT ONLY (see scope note above)
// ---------------------------------------------------------------------------

export interface PaymentCheckoutRequest {
  orderId: string;
  amount: number;
  currency: string;
  returnUrl: string;
}

export interface PaymentCheckoutResult {
  redirectUrl: string;
  providerReference: string;
}

export interface PaymentPlugin {
  readonly id: string; // e.g. "bkash", "binance-pay"
  readonly name: string;
  isConfigured(): boolean;
  createCheckout(req: PaymentCheckoutRequest): Promise<PaymentCheckoutResult>;
  /** Verifies an inbound webhook's authenticity (signature/HMAC check). */
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<boolean>;
}
