import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { executeAgentAction } from "@/lib/agent-actions.functions";

export function EmailBlastPanel() {
  const execFn = useServerFn(executeAgentAction);
  const [emailSubject, setEmailSubject] = useState("Special offer for you");
  const [emailHtml, setEmailHtml] = useState(
    "<h1>Hi!</h1><p>Check out our latest deals at AR Prime Market.</p>",
  );

  const blast = useMutation({
    mutationFn: () =>
      execFn({
        data: {
          action_type: "send_marketing_email",
          label: `Email blast: ${emailSubject}`,
          reasoning: "Admin manual blast",
          payload: { subject: emailSubject, html: emailHtml },
          decision: "confirm",
        },
      }),
    onSuccess: (r) => toast.success(r.result_message),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Mail className="w-4 h-4" /> Email Blast (Resend)
        </h3>
        <p className="text-xs text-muted-foreground">সকল customer-কে একসাথে email পাঠান</p>
      </div>
      <Input
        value={emailSubject}
        onChange={(e) => setEmailSubject(e.target.value)}
        placeholder="Subject"
      />
      <Textarea
        rows={8}
        value={emailHtml}
        onChange={(e) => setEmailHtml(e.target.value)}
        placeholder="HTML body"
        className="font-mono text-xs"
      />
      <Button size="sm" onClick={() => blast.mutate()} disabled={blast.isPending}>
        {blast.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
        Send to all customers
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Sender: onboarding@resend.dev — verify your domain in Resend for production.
      </p>
    </Card>
  );
}
