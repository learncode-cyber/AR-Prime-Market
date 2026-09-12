import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Telegram webhook handler for CEO approvals
// Handles inline button callbacks for Apply Flow tasks

interface TelegramUpdate {
  callback_query?: {
    id: string;
    from: { id: number };
    data: string;
  };
  message?: {
    text: string;
    from: { id: number };
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update: TelegramUpdate = await req.json();

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const { data, id } = update.callback_query;

      if (data.startsWith("apply_")) {
        const taskId = data.replace("apply_", "");
        // Process approval
        console.log(`[Telegram] CEO approved task: ${taskId}`);
        
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } else if (data.startsWith("deny_")) {
        const taskId = data.replace("deny_", "");
        // Process denial
        console.log(`[Telegram] CEO denied task: ${taskId}`);
        
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle text messages
    if (update.message?.text) {
      const text = update.message.text.toLowerCase();
      if (text.includes("apply") || text.includes("koro")) {
        console.log(`[Telegram] CEO sent approval command`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Telegram] Error:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
