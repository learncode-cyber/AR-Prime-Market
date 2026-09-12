import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BinanceLogo } from "@/components/BinanceLogo";

interface BinancePayModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  orderNumber?: string | null;
  guestToken?: string | null;
  fiatAmount: number;
  fiatCurrency: string;
  onPaid?: () => void;
}

type Stage = "initializing" | "ready" | "paid" | "error";

export function BinancePayModal({
  open,
  onClose,
  orderId,
  orderNumber,
  guestToken,
  fiatAmount,
  fiatCurrency,
  onPaid,
}: BinancePayModalProps) {
  const [stage, setStage] = useState<Stage>("initializing");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<string | null>(null);
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [prepayId, setPrepayId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const initRef = useRef(false);

  // Create the Binance Pay order on open
  useEffect(() => {
    if (!open || !orderId || initRef.current) return;
    initRef.current = true;
    setStage("initializing");
    setErrorMsg(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke("binance-pay-gateway", {
        body: { action: "create", order_id: orderId, guest_token: guestToken || undefined },
      });
      if (error || !data?.success) {
        setErrorMsg(data?.message || error?.message || "Failed to initialize Binance Pay");
        setStage("error");
        return;
      }
      setCheckoutUrl(data.checkoutUrl);
      setQrLink(data.qrcodeLink || null);
      setUsdtAmount(data.usdt_amount ?? null);
      setPrepayId(data.prepayId || null);
      setStage("ready");
    })();
  }, [open, orderId, guestToken]);

  // Poll for payment completion
  useEffect(() => {
    if (stage !== "ready" || !orderId) return;
    const tick = async () => {
      const { data } = await supabase.functions.invoke("binance-pay-gateway", {
        body: { action: "verify", order_id: orderId, prepayId },
      });
      if (data?.paid) {
        setStage("paid");
        if (pollRef.current) window.clearInterval(pollRef.current);
        onPaid?.();
      }
    };
    pollRef.current = window.setInterval(tick, 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [stage, orderId, prepayId, onPaid]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      initRef.current = false;
      setCheckoutUrl(null);
      setQrLink(null);
      setUsdtAmount(null);
      setPrepayId(null);
      setStage("initializing");
      setErrorMsg(null);
    }
  }, [open]);

  const copyUrl = async () => {
    if (!checkoutUrl) return;
    await navigator.clipboard.writeText(checkoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-white ring-1 ring-[#F0B90B]/40">
              <BinanceLogo className="w-5 h-5" />
            </span>
            Pay with Binance Pay
          </DialogTitle>
          <DialogDescription>
            Order {orderNumber ? <span className="font-mono">#{orderNumber}</span> : null} ·{" "}
            {fiatCurrency} {fiatAmount.toFixed(2)}
            {usdtAmount != null && (
              <>
                {" "}
                →{" "}
                <span className="font-semibold text-foreground">{usdtAmount.toFixed(2)} USDT</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {stage === "initializing" && (
          <div className="py-10 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            Initializing secure crypto checkout…
          </div>
        )}

        {stage === "error" && (
          <div className="py-6 space-y-3 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-red-500" />
            <p className="text-sm text-red-600">{errorMsg}</p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {stage === "ready" && (
          <div className="space-y-4">
            {qrLink && (
              <div className="flex justify-center">
                <img
                  src={qrLink}
                  alt="Binance Pay QR"
                  className="w-48 h-48 rounded-lg border bg-white p-2"
                />
              </div>
            )}
            <p className="text-xs text-center text-muted-foreground">
              Scan the QR with your Binance app, or open the checkout link below.
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1 bg-[#F0B90B] hover:bg-[#d8a40a] text-black">
                <a href={checkoutUrl!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open Binance Checkout
                </a>
              </Button>
              <Button variant="outline" onClick={copyUrl} aria-label="Copy checkout URL">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-center text-muted-foreground inline-flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Waiting for payment confirmation…
            </p>
          </div>
        )}

        {stage === "paid" && (
          <div className="py-6 space-y-3 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <p className="font-semibold">Payment confirmed!</p>
            <p className="text-sm text-muted-foreground">Your order is now being processed.</p>
            <Button onClick={onClose}>Continue</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
