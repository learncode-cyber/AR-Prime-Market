// Shared Telegram Bot API helper with retry + fallback chat IDs
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const PRIMARY_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";
// Comma-separated fallback IDs, e.g. "-100123,-100456" or a personal user ID
const FALLBACK_CHAT_IDS = (Deno.env.get("TELEGRAM_FALLBACK_CHAT_IDS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ATTEMPTS = 4; // per chat id
const BASE_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Errors that should NOT be retried (config / permission issues)
function isFatal(status: number, desc: string): boolean {
  if (status === 400 || status === 401 || status === 403 || status === 404) return true;
  const d = desc.toLowerCase();
  return (
    d.includes("chat not found") ||
    d.includes("bot was blocked") ||
    d.includes("not enough rights") ||
    d.includes("can't send messages to the bot")
  );
}

async function sendOnce(
  chatId: string,
  text: string,
  parseMode: string,
  disablePreview: boolean,
): Promise<{ ok: boolean; status: number; response: any; retryAfter?: number }> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: disablePreview,
      }),
    });
    const j = await r.json().catch(() => ({}));
    const retryAfter = j?.parameters?.retry_after;
    return { ok: r.ok && j?.ok !== false, status: r.status, response: j, retryAfter };
  } catch (e) {
    return { ok: false, status: 0, response: { error: String(e) } };
  }
}

async function deliverToChat(
  chatId: string,
  text: string,
  parseMode: string,
  disablePreview: boolean,
) {
  let last: any = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await sendOnce(chatId, text, parseMode, disablePreview);
    last = res;
    if (res.ok) {
      if (attempt > 1) console.log(`[telegram] delivered to ${chatId} on attempt ${attempt}`);
      return { ok: true, chatId, attempts: attempt, response: res.response };
    }
    const desc = res.response?.description || "";
    console.warn(
      `[telegram] attempt ${attempt}/${MAX_ATTEMPTS} → ${chatId} failed`,
      res.status,
      desc,
    );

    if (isFatal(res.status, desc)) {
      return { ok: false, chatId, attempts: attempt, status: res.status, response: res.response };
    }
    // Honor Telegram rate-limit hint
    const delay = res.retryAfter
      ? res.retryAfter * 1000
      : BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
    if (attempt < MAX_ATTEMPTS) await sleep(delay);
  }
  return {
    ok: false,
    chatId,
    attempts: MAX_ATTEMPTS,
    status: last?.status,
    response: last?.response,
  };
}

export async function sendTelegramMessage(
  text: string,
  opts: { chatId?: string; parseMode?: "HTML" | "MarkdownV2"; disablePreview?: boolean } = {},
) {
  if (!BOT_TOKEN) {
    console.warn("[telegram] Missing TELEGRAM_BOT_TOKEN");
    return { ok: false, error: "telegram_not_configured" };
  }

  const parseMode = opts.parseMode || "HTML";
  const disablePreview = opts.disablePreview ?? true;

  // Build delivery target list: explicit override OR primary + fallbacks
  const targets: string[] = [];
  if (opts.chatId) {
    targets.push(opts.chatId);
  } else {
    if (PRIMARY_CHAT_ID) targets.push(PRIMARY_CHAT_ID);
    for (const id of FALLBACK_CHAT_IDS) if (!targets.includes(id)) targets.push(id);
  }

  if (targets.length === 0) {
    console.warn("[telegram] No chat IDs configured");
    return { ok: false, error: "telegram_not_configured" };
  }

  const trail: any[] = [];
  for (const chatId of targets) {
    const r = await deliverToChat(chatId, text, parseMode, disablePreview);
    trail.push(r);
    if (r.ok) {
      return { ok: true, response: r.response, deliveredTo: chatId, attempts: r.attempts, trail };
    }
    console.error(`[telegram] giving up on ${chatId} after ${r.attempts} attempts`);
  }

  console.error("[telegram] all targets failed", JSON.stringify(trail));
  return { ok: false, error: "all_targets_failed", trail };
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
