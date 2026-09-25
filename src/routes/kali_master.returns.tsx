import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, XCircle, RefreshCw, Image as ImageIcon, Eye, Loader2 } from "lucide-react";

export const Route = createFileRoute("/kali_master/returns")({
  component: AdminReturnsPage,
});

type ReturnRow = {
  id: string;
  order_id: string | null;
  user_id: string | null;
  status: string | null;
  reason: string | null;
  reason_category: string | null;
  description: string | null;
  photo_urls: string[] | null;
  admin_notes: string | null;
  created_at: string | null;
  processed_at: string | null;
  refunded_at: string | null;
  orders?: {
    id: string;
    order_number: string | null;
    total_amount: number;
    payment_method: string | null;
    shipping_address: string | null;
    guest_email: string | null;
  } | null;
  profiles?: { email: string | null } | null;
};

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-blue-500/10 text-blue-600",
  rejected: "bg-destructive/10 text-destructive",
  refunded: "bg-green-500/10 text-green-600",
};

function AdminReturnsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ReturnRow | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [working, setWorking] = useState(false);

  const {
    data: returns = [],
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["admin-returns", filter],
    queryFn: async () => {
      let q = supabase
        .from("return_requests")
        .select(
          "*, orders(id, order_number, total_amount, payment_method, shipping_address, guest_email), profiles:user_id(email)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return data as any[] as ReturnRow[];
    },
  });

  const openDetail = (r: ReturnRow) => {
    setSelected(r);
    setAdminNote(r.admin_notes || "");
  };

  const getSignedUrls = async (entries: string[]) => {
    // Entries may be full URLs (new ImgBB / public-bucket flow) or storage paths (legacy).
    const results = await Promise.all(
      entries.map(async (p) => {
        if (/^https?:\/\//i.test(p)) return p;
        const { data } = await supabase.storage.from("return-images").createSignedUrl(p, 3600);
        return data?.signedUrl || null;
      }),
    );
    return results.filter(Boolean) as string[];
  };

  const { data: photoUrls = [] } = useQuery({
    queryKey: ["return-photos", selected?.id],
    enabled: !!selected?.photo_urls?.length,
    queryFn: () => getSignedUrls(selected!.photo_urls!),
  });

  const updateStatus = async (next: "approved" | "rejected" | "refunded") => {
    if (!selected) return;
    setWorking(true);
    try {
      const patch: any = {
        status: next,
        admin_notes: adminNote || null,
        processed_at: new Date().toISOString(),
      };
      if (next === "refunded") patch.refunded_at = new Date().toISOString();

      const { error } = await supabase.from("return_requests").update(patch).eq("id", selected.id);
      if (error) throw error;

      // Automation on approve/refund: mark order refunded + send notification email
      if ((next === "approved" || next === "refunded") && selected.orders?.id) {
        await supabase
          .from("orders")
          .update({
            payment_status: next === "refunded" ? "refunded" : "refund_pending",
          })
          .eq("id", selected.orders.id);
      }

      // Always queue an email_log entry for customer notification
      const toEmail = selected.profiles?.email || selected.orders?.guest_email;
      if (toEmail) {
        const subject =
          next === "approved"
            ? `Return approved — ${selected.orders?.order_number || ""}`
            : next === "rejected"
              ? `Return request update — ${selected.orders?.order_number || ""}`
              : `Refund processed — ${selected.orders?.order_number || ""}`;
        const body =
          next === "approved"
            ? `Good news! Your return request for order ${selected.orders?.order_number} has been approved. Please follow the return instructions sent separately. Reason: ${selected.reason}. ${adminNote ? "Notes: " + adminNote : ""}`
            : next === "rejected"
              ? `Your return request for order ${selected.orders?.order_number} could not be approved. ${adminNote ? "Reason: " + adminNote : "Please contact support for details."}`
              : `Your refund of ${selected.orders?.total_amount} BDT for order ${selected.orders?.order_number} has been processed. It may take 3-7 business days to appear in your account.`;

        await supabase.from("email_logs").insert({
          to_address: toEmail,
          subject,
          body,
          status: "pending",
        });
        // Fire-and-forget send
        supabase.functions.invoke("send-email", { body: {} }).catch(() => {});
      }

      toast.success(`স্ট্যাটাস "${next}" করা হলো`);
      setSelected(null);
      refetch();
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || "Failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Return Requests</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer return requests and refunds.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-left px-4 py-3">Photos</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No return requests yet
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.orders?.order_number || r.order_id?.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.profiles?.email || r.orders?.guest_email || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {r.reason}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(r.photo_urls?.length || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <ImageIcon className="w-3 h-3" />
                          {r.photo_urls!.length}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusStyle[r.status || "pending"] + " border-0"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openDetail(r)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o && !working) setSelected(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Return — {selected?.orders?.order_number}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">
                    {selected.profiles?.email || selected.orders?.guest_email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Total</p>
                  <p className="font-medium">{selected.orders?.total_amount} BDT</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment</p>
                  <p className="font-medium">{selected.orders?.payment_method || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={statusStyle[selected.status || "pending"] + " border-0"}>
                    {selected.status}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm font-medium">{selected.reason}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm bg-secondary/40 rounded-xl px-3 py-2 whitespace-pre-wrap">
                  {selected.description || "—"}
                </p>
              </div>

              {photoUrls.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Customer Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {photoUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-20 h-20 rounded-lg overflow-hidden border border-border block"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1">Admin Notes (sent to customer)</p>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add notes about this decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSelected(null)} disabled={working}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => updateStatus("rejected")}
              disabled={working || selected?.status === "rejected"}
            >
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              onClick={() => updateStatus("approved")}
              disabled={
                working || selected?.status === "approved" || selected?.status === "refunded"
              }
            >
              {working ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1" />
              )}{" "}
              Approve
            </Button>
            <Button
              onClick={() => updateStatus("refunded")}
              disabled={working || selected?.status === "refunded"}
              className="bg-green-600 hover:bg-green-700"
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Mark Refunded
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
