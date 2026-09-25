import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, DollarSign, Radio, Sparkles, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { FeatureGate } from "@/components/FeatureGate";

export const Route = createFileRoute("/account/affiliate")({
  head: () => ({
    meta: [
      { title: "Affiliate Dashboard — AR Prime Market" },
      {
        name: "description",
        content: "Live affiliate earnings, referral link, and commission feed.",
      },
    ],
  }),
  component: () => (
    <FeatureGate flag="affiliate_program">
      <AffiliatePage />
    </FeatureGate>
  ),
});

type Affiliate = {
  id: string;
  code: string;
  status: string;
  name: string | null;
  email: string | null;
  website: string | null;
  payout_method: string | null;
  created_at: string;
};

type Commission = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  order_id: string | null;
};

function AffiliatePage() {
  const { user } = useAuth();
  const { formatPrice, currencies } = useCurrency();
  const qc = useQueryClient();
  const [livePulse, setLivePulse] = useState(false);
  const [connected, setConnected] = useState(false);

  const { data: affiliate, isLoading: aLoading } = useQuery({
    queryKey: ["my-affiliate", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as Affiliate | null;
    },
  });

  const { data: commissions = [], isLoading: cLoading } = useQuery({
    queryKey: ["my-commissions", affiliate?.id],
    enabled: !!affiliate?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_commissions")
        .select("*")
        .eq("affiliate_id", affiliate!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as Commission[];
    },
  });

  // Realtime subscription to private channel "affiliate:<id>"
  useEffect(() => {
    if (!affiliate?.id) return;
    const topic = `affiliate:${affiliate.id}`;
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "affiliate_commissions_insert" }, (payload) => {
        const rec = (payload.payload as any)?.record as Commission | undefined;
        qc.invalidateQueries({ queryKey: ["my-commissions", affiliate.id] });
        if (rec)
          toast.success(`+${formatPrice(Number(rec.amount), rec.currency || "USD")} নতুন কমিশন!`, {
            icon: "💸",
          });
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 1200);
      })
      .on("broadcast", { event: "affiliate_commissions_update" }, () => {
        qc.invalidateQueries({ queryKey: ["my-commissions", affiliate.id] });
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 1200);
      })
      .on("broadcast", { event: "affiliate_commissions_delete" }, () => {
        qc.invalidateQueries({ queryKey: ["my-commissions", affiliate.id] });
      })
      .on("broadcast", { event: "affiliates_update" }, () => {
        qc.invalidateQueries({ queryKey: ["my-affiliate", user?.id] });
        toast.message("Affiliate প্রোফাইল আপডেট হয়েছে");
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [affiliate?.id, user?.id, qc, formatPrice]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <Link
            to="/login"
            className="inline-block px-6 py-3 rounded-lg bg-primary text-primary-foreground"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (aLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (!affiliate) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <Sparkles className="w-12 h-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Become an Affiliate</h1>
          <p className="text-muted-foreground">
            আপনার এখনো affiliate অ্যাকাউন্ট নেই। যোগাযোগ করুন admin-এর সাথে activate করার জন্য।
          </p>
          <Link
            to="/contact"
            className="inline-block px-6 py-3 rounded-lg bg-primary text-primary-foreground"
          >
            Contact us
          </Link>
        </div>
      </div>
    );
  }

  const toUsd = (c: { amount: number; currency: string }) => {
    const rate = currencies.find((cur) => cur.code === (c.currency || "USD"))?.rate ?? 1;
    return Number(c.amount || 0) / rate;
  };
  const totalEarned = commissions.reduce((s, c) => s + toUsd(c), 0);
  const pending = commissions
    .filter((c) => c.status === "pending")
    .reduce((s, c) => s + toUsd(c), 0);
  const paid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + toUsd(c), 0);
  const refLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${affiliate.code}`
      : `/?ref=${affiliate.code}`;

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Affiliate Dashboard</h1>
          <p className="text-muted-foreground text-sm">Live commissions feed</p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${connected ? "border-green-500/30 bg-green-500/10 text-green-600" : "border-border bg-muted text-muted-foreground"} ${livePulse ? "animate-pulse" : ""}`}
        >
          <Radio className={`w-3.5 h-3.5 ${connected ? "text-green-500" : ""}`} />
          {connected ? "Live" : "Connecting…"}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total earned"
          value={formatPrice(totalEarned, "USD")}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Pending"
          value={formatPrice(pending, "USD")}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Paid out"
          value={formatPrice(paid, "USD")}
        />
      </div>

      {/* Referral */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Your referral code</div>
            <div className="text-2xl font-mono font-bold text-primary">{affiliate.code}</div>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full ${affiliate.status === "active" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}
          >
            {affiliate.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={refLink}
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(refLink);
              toast.success("লিঙ্ক কপি হয়েছে");
            }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copy
          </button>
        </div>
      </div>

      {/* Commissions feed */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Commissions feed</h2>
          <span className="text-xs text-muted-foreground">{commissions.length} entries</span>
        </div>
        {cLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            এখনো কোনো কমিশন নেই। লিঙ্ক শেয়ার করুন!
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {commissions.map((c) => (
              <li key={c.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {formatPrice(Number(c.amount), c.currency || "USD")}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {new Date(c.created_at).toLocaleString()}{" "}
                    {c.order_id ? `· order ${c.order_id.slice(0, 8)}` : ""}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                    c.status === "paid"
                      ? "bg-green-500/10 text-green-600"
                      : c.status === "pending"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
