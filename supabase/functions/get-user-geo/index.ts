// Edge Function: get-user-geo
// Detects user country/region from request headers, with fallback to ipapi.co.
// Returns { country, country_name, currency, language, dial } — safe defaults on any failure.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ISO country -> currency code
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  AU: "AUD",
  NZ: "AUD",
  AE: "AED",
  SA: "SAR",
  QA: "AED",
  KW: "AED",
  BH: "AED",
  OM: "AED",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  SE: "EUR",
  NO: "EUR",
  DK: "EUR",
  PL: "EUR",
  CZ: "EUR",
  HU: "EUR",
  RO: "EUR",
  CH: "EUR",
  BD: "BDT",
  IN: "INR",
  PK: "PKR",
  LK: "INR",
  NP: "INR",
  JP: "JPY",
  CN: "CNY",
  HK: "CNY",
  TW: "CNY",
  KR: "KRW",
  TR: "TRY",
  RU: "RUB",
  BR: "BRL",
  MX: "USD",
  AR: "USD",
  EG: "AED",
  ZA: "USD",
  NG: "USD",
  KE: "USD",
  SG: "USD",
  MY: "USD",
  ID: "USD",
  PH: "USD",
  TH: "USD",
  VN: "USD",
};

// ISO country -> default UI language
const COUNTRY_LANG: Record<string, string> = {
  US: "en",
  CA: "en",
  GB: "en",
  AU: "en",
  NZ: "en",
  IE: "en",
  AE: "ar",
  SA: "sa",
  QA: "ar",
  KW: "ar",
  BH: "ar",
  OM: "ar",
  EG: "ar",
  DE: "de",
  AT: "de",
  CH: "de",
  FR: "fr",
  BE: "fr",
  LU: "fr",
  IT: "it",
  ES: "es",
  PT: "pt",
  NL: "nl",
  SE: "sv",
  NO: "no",
  DK: "da",
  FI: "fi",
  GR: "el",
  PL: "pl",
  CZ: "cs",
  HU: "hu",
  RO: "ro",
  UA: "uk",
  RU: "ru",
  TR: "tr",
  BD: "bn",
  IN: "hi",
  PK: "ur",
  JP: "ja",
  CN: "zh",
  HK: "zh",
  TW: "zh",
  KR: "ko",
  TH: "th",
  VN: "vi",
  ID: "id",
  MY: "ms",
  PH: "tl",
  SG: "en",
  BR: "pt",
  MX: "es",
  AR: "es",
  IL: "he",
  IR: "fa",
};

// ISO country -> dial code (subset; rest fall back to "+1")
const COUNTRY_DIAL: Record<string, string> = {
  US: "+1",
  CA: "+1",
  GB: "+44",
  AU: "+61",
  NZ: "+64",
  AE: "+971",
  SA: "+966",
  QA: "+974",
  KW: "+965",
  BH: "+973",
  OM: "+968",
  DE: "+49",
  FR: "+33",
  IT: "+39",
  ES: "+34",
  NL: "+31",
  BE: "+32",
  AT: "+43",
  PT: "+351",
  IE: "+353",
  CH: "+41",
  SE: "+46",
  NO: "+47",
  DK: "+45",
  PL: "+48",
  BD: "+880",
  IN: "+91",
  PK: "+92",
  JP: "+81",
  CN: "+86",
  HK: "+852",
  KR: "+82",
  TR: "+90",
  RU: "+7",
  BR: "+55",
  MX: "+52",
  AR: "+54",
  EG: "+20",
  ZA: "+27",
  NG: "+234",
  KE: "+254",
  SG: "+65",
  MY: "+60",
  ID: "+62",
  PH: "+63",
  TH: "+66",
  VN: "+84",
};

function pickIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
}

async function lookupByIp(ip: string): Promise<string | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const txt = (await res.text()).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(txt) ? txt : null;
  } catch {
    return null;
  }
}

function build(country: string, source: string) {
  const iso = country.toUpperCase();
  return {
    country: iso,
    currency: COUNTRY_CURRENCY[iso] ?? "USD",
    language: COUNTRY_LANG[iso] ?? "en",
    dial: COUNTRY_DIAL[iso] ?? "+1",
    source,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // 1. Cloudflare-style header (works on some edge networks)
  const cf = req.headers.get("cf-ipcountry");
  if (cf && /^[A-Z]{2}$/i.test(cf) && cf.toUpperCase() !== "XX") {
    return json(build(cf, "cf-header"));
  }

  // 2. IP-based lookup
  const ip = pickIp(req);
  if (ip) {
    const country = await lookupByIp(ip);
    if (country) return json(build(country, "ipapi"));
  }

  // 3. Accept-Language hint (e.g. "en-AE,en;q=0.9")
  const al = req.headers.get("accept-language") || "";
  const m = /-([A-Z]{2})/i.exec(al);
  if (m) return json(build(m[1], "accept-language"));

  // 4. Safe default
  return json(build("US", "default"));
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=600",
    },
  });
}
