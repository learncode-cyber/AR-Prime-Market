// Shared definitions and helpers for the API Keys / Integrations admin pages.
// Built-in providers are hardcoded here; custom providers are stored entirely
// in the `api_credentials` table, with their field schema serialized inside
// the credentials JSON under reserved keys prefixed with `__`.

export type FieldType = "text" | "email" | "password";

export interface IntegrationField {
  name: string;
  label: string;
  type: FieldType;
}

export interface IntegrationDef {
  key: string;
  label: string;
  badgeClass: string;
  helpText: string;
  helpUrl?: string;
  fields: IntegrationField[];
  /** true when this provider has a server-side test handler in test-credentials edge fn */
  testable: boolean;
  /** true when the user added it manually (not in BUILTIN_PROVIDERS) */
  isCustom: boolean;
}

export const BUILTIN_PROVIDERS: IntegrationDef[] = [
  {
    key: "gemini",
    label: "Google Gemini AI",
    badgeClass: "bg-indigo-500 hover:bg-indigo-600",
    helpText:
      "Powers every AI feature on the site: Raiyan AI shopping assistant, blog auto-generation, product AI content, and the marketing agent network. Get a free key from Google AI Studio.",
    helpUrl: "https://aistudio.google.com/apikey",
    fields: [{ name: "api_key", label: "Gemini API Key", type: "password" }],
    testable: true,
    isCustom: false,
  },
  {
    key: "steadfast",
    label: "SteadFast Courier",
    badgeClass: "bg-green-500 hover:bg-green-600",
    helpText:
      "From SteadFast merchant portal → API settings. Required for COD courier auto-booking.",
    helpUrl: "https://steadfast.com.bd/user/api",
    fields: [
      { name: "api_key", label: "Steadfast API Key", type: "text" },
      { name: "secret_key", label: "Steadfast Secret Key", type: "password" },
    ],
    testable: true,
    isCustom: false,
  },
  {
    key: "cj_dropshipping",
    label: "CJ Dropshipping",
    badgeClass: "bg-orange-500 hover:bg-orange-600",
    helpText:
      "Use your CJdropshipping.com login. Used to fetch products and place supplier orders for international shipping.",
    helpUrl: "https://developers.cjdropshipping.com/",
    fields: [
      { name: "email", label: "Account Email", type: "email" },
      { name: "password", label: "Account Password", type: "password" },
      { name: "api_key", label: "API Key (optional)", type: "text" },
    ],
    testable: true,
    isCustom: false,
  },
  {
    key: "aliexpress",
    label: "AliExpress",
    badgeClass: "bg-blue-500 hover:bg-blue-600",
    helpText:
      "Create a Dropshipping app on AliExpress Open Platform to get App Key / Secret / Access Token.",
    helpUrl: "https://openservice.aliexpress.com/",
    fields: [
      { name: "app_key", label: "App Key (API Key)", type: "text" },
      { name: "app_secret", label: "App Secret", type: "password" },
      { name: "access_token", label: "Access Token", type: "password" },
    ],
    testable: true,
    isCustom: false,
  },
];

export const CUSTOM_BADGE_CLASS = "bg-purple-500 hover:bg-purple-600";

// Reserved keys we stash inside the `credentials` jsonb so custom integrations
// keep their schema with them. Real credential values must never start with `__`.
const RESERVED_KEYS = new Set([
  "__schema__",
  "__label__",
  "__help_text__",
  "__help_url__",
  "__custom__",
]);

export function isReservedKey(name: string) {
  return RESERVED_KEYS.has(name) || name.startsWith("__");
}

export interface StoredCredRow {
  provider: string;
  label?: string | null;
  credentials: Record<string, unknown>;
  is_active: boolean;
  updated_at?: string | null;
}

/**
 * Strip the schema/meta keys from a credentials jsonb blob, returning only
 * the actual user-facing credential values.
 */
export function pickCredentialValues(
  credentials: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!credentials) return out;
  for (const [k, v] of Object.entries(credentials)) {
    if (isReservedKey(k)) continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Build an IntegrationDef from a stored row that does not match a built-in
 * provider (i.e. a custom integration the admin added).
 */
function customDefFromRow(row: StoredCredRow): IntegrationDef {
  const meta = row.credentials || {};
  const rawSchema = Array.isArray((meta as any).__schema__)
    ? ((meta as any).__schema__ as IntegrationField[])
    : [];
  const fields: IntegrationField[] = rawSchema
    .filter((f) => f && typeof f.name === "string" && f.name.length > 0 && !isReservedKey(f.name))
    .map((f) => ({
      name: f.name,
      label: f.label || f.name,
      type: f.type === "password" || f.type === "email" ? f.type : "text",
    }));

  return {
    key: row.provider,
    label:
      (typeof (meta as any).__label__ === "string" && (meta as any).__label__) ||
      row.label ||
      row.provider,
    badgeClass: CUSTOM_BADGE_CLASS,
    helpText:
      (typeof (meta as any).__help_text__ === "string" && (meta as any).__help_text__) ||
      "Custom integration.",
    helpUrl:
      typeof (meta as any).__help_url__ === "string" ? (meta as any).__help_url__ : undefined,
    fields,
    testable: false,
    isCustom: true,
  };
}

/**
 * Merge built-in providers with any custom providers found in stored rows.
 * Built-in providers always appear (even when they have no row yet) so they
 * can be configured. Custom providers only appear once stored.
 */
export function mergeProviders(storedRows: StoredCredRow[]): IntegrationDef[] {
  const builtinKeys = new Set(BUILTIN_PROVIDERS.map((p) => p.key));
  const customs = storedRows.filter((r) => !builtinKeys.has(r.provider)).map(customDefFromRow);
  return [...BUILTIN_PROVIDERS, ...customs];
}

export function findProvider(storedRows: StoredCredRow[], key: string): IntegrationDef | undefined {
  const builtin = BUILTIN_PROVIDERS.find((p) => p.key === key);
  if (builtin) return builtin;
  const row = storedRows.find((r) => r.provider === key);
  if (!row) return undefined;
  return customDefFromRow(row);
}

/**
 * Build the credentials payload to persist. For custom integrations we keep
 * the schema/meta inline so a reload re-creates the form. Built-ins skip
 * the meta because their schema lives in code.
 */
export function buildCredentialsPayload(
  def: IntegrationDef,
  values: Record<string, string>,
): Record<string, unknown> {
  const cleanValues: Record<string, string> = {};
  for (const f of def.fields) {
    const v = values[f.name];
    if (typeof v === "string") cleanValues[f.name] = v;
  }
  if (!def.isCustom) return cleanValues;
  return {
    ...cleanValues,
    __custom__: true,
    __label__: def.label,
    __help_text__: def.helpText,
    __help_url__: def.helpUrl ?? "",
    __schema__: def.fields,
  };
}

/** Slugify a provider name into a safe key for the `provider` column. */
export function slugifyProviderKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}
