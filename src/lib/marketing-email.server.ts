import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RESEND_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "AR Prime Market <onboarding@resend.dev>"; // swap to verified domain when ready

export async function sendMarketingEmailToAllCustomers(
  subject: string,
  html: string,
  triggeredBy: string | null,
  agentTaskId: string | null,
): Promise<{ sent: number; failed: number; blastId: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing");

  // Pull all customer emails (skip nulls + dedupe)
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .not("email", "is", null)
    .limit(5000);

  const recipients = Array.from(
    new Set((profiles ?? []).map((p: any) => String(p.email).toLowerCase()).filter(Boolean)),
  );

  const { data: blast, error: blastErr } = await supabaseAdmin
    .from("marketing_blasts")
    .insert({
      channel: "email",
      subject,
      body: html,
      recipient_count: recipients.length,
      status: "sending",
      triggered_by: triggeredBy,
      agent_task_id: agentTaskId,
    } as never)
    .select("id")
    .single();
  if (blastErr) throw blastErr;
  const blastId = (blast as any).id as string;

  let sent = 0,
    failed = 0;
  // Resend allows up to 50 in batch via "to" array; but to keep deliverability good, send individually with throttle.
  // For speed we chunk and use Promise.all per batch.
  const chunkSize = 10;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((to) =>
        fetch(RESEND_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
        }).then(async (r) => {
          if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
        }),
      ),
    );
    sent += results.filter((r) => r.status === "fulfilled").length;
    failed += results.filter((r) => r.status === "rejected").length;
  }

  await supabaseAdmin
    .from("marketing_blasts")
    .update({
      success_count: sent,
      failure_count: failed,
      status: failed === recipients.length && recipients.length > 0 ? "failed" : "completed",
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", blastId);

  return { sent, failed, blastId };
}
