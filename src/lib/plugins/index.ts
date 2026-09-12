import { PluginRegistry } from "./registry";
import type { AIProviderPlugin, SupplierPlugin, PaymentPlugin } from "./types";
import { geminiPlugin } from "./ai-providers/gemini-plugin";

export { PluginRegistry } from "./registry";
export type { RegistrablePlugin } from "./registry";
export type {
  AIProviderPlugin,
  SupplierPlugin,
  SupplierProduct,
  PaymentPlugin,
  PaymentCheckoutRequest,
  PaymentCheckoutResult,
} from "./types";
export { geminiPlugin } from "./ai-providers/gemini-plugin";

/**
 * The live AI provider registry, pre-populated with the Gemini plugin as
 * the default (matching current production behavior exactly). Additional
 * providers (OpenAI, Claude, etc.) can be registered here without touching
 * any existing call site — they only need to opt in to using the registry.
 */
export const aiProviderRegistry = new PluginRegistry<AIProviderPlugin>();
aiProviderRegistry.register(geminiPlugin, { setDefault: true });

/**
 * Supplier and payment registries — created empty. Populating these with
 * real adapters (CJ Dropshipping, AliExpress, Spocket / bKash, Binance Pay)
 * is deliberately out of scope for this module; see
 * docs/architecture/PLUGIN_SYSTEM.md for why and what the migration path
 * looks like. Exported now so the shape is stable for that future work.
 */
export const supplierRegistry = new PluginRegistry<SupplierPlugin>();
export const paymentRegistry = new PluginRegistry<PaymentPlugin>();
