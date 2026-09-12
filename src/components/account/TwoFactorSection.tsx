import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2, Copy, X, KeyRound, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { generateRecoveryCodes, getRecoveryCodesStatus } from "@/lib/mfa-recovery.functions";
import { RecoveryCodesModal } from "./RecoveryCodesModal";

type Factor = { id: string; friendly_name?: string | null; status: string; created_at: string };

export function TwoFactorSection() {
  const generateCodesFn = useServerFn(generateRecoveryCodes);
  const getStatusFn = useServerFn(getRecoveryCodesStatus);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [pending, setPending] = useState<{
    factorId: string;
    qr: string;
    secret: string;
    uri?: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [shownCodes, setShownCodes] = useState<string[] | null>(null);
  const [codesStatus, setCodesStatus] = useState<{ total: number; remaining: number } | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [regenCode, setRegenCode] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  const verified = factors.filter((f) => f.status === "verified");
  const enabled = verified.length > 0;

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return toast.error(error.message);
    const list = [...(data?.totp || [])] as Factor[];
    setFactors(list);
    if (list.some((f) => f.status === "verified")) {
      try {
        setCodesStatus(await getStatusFn());
      } catch {
        /* ignore */
      }
    } else {
      setCodesStatus(null);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });
    setEnrolling(false);
    if (error) return toast.error(error.message);
    if (!data) return;
    setPending({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
    setCode("");
  };

  const cancelEnroll = async () => {
    if (!pending) return;
    await supabase.auth.mfa.unenroll({ factorId: pending.factorId });
    setPending(null);
    refresh();
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code");
    setVerifying(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: pending.factorId,
    });
    if (chalErr || !chal) {
      setVerifying(false);
      return toast.error(chalErr?.message || "Could not start verification");
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: pending.factorId,
      challengeId: chal.id,
      code,
    });
    if (error) {
      setVerifying(false);
      return toast.error(error.message);
    }
    // Generate recovery codes immediately on first enable
    try {
      const { codes } = await generateCodesFn();
      setShownCodes(codes);
      toast.success("Two-factor authentication enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate recovery codes");
    }
    setVerifying(false);
    setPending(null);
    setCode("");
    refresh();
  };

  const confirmRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenId) return;
    if (!/^\d{6}$/.test(regenCode)) return toast.error("Enter the 6-digit code");
    setRegenLoading(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: regenId });
    if (chalErr || !chal) {
      setRegenLoading(false);
      return toast.error(chalErr?.message || "Verification failed");
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: regenId,
      challengeId: chal.id,
      code: regenCode,
    });
    if (verErr) {
      setRegenLoading(false);
      return toast.error(verErr.message);
    }
    try {
      const { codes } = await generateCodesFn();
      setShownCodes(codes);
      toast.success("New recovery codes generated. Old codes are now invalid.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate codes");
    }
    setRegenLoading(false);
    setRegenId(null);
    setRegenCode("");
    refresh();
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableId) return;
    if (!/^\d{6}$/.test(disableCode)) return toast.error("Enter the 6-digit code");
    setDisabling(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: disableId,
    });
    if (chalErr || !chal) {
      setDisabling(false);
      return toast.error(chalErr?.message || "Verification failed");
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: disableId,
      challengeId: chal.id,
      code: disableCode,
    });
    if (verErr) {
      setDisabling(false);
      return toast.error(verErr.message);
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: disableId });
    setDisabling(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication disabled");
    setDisableId(null);
    setDisableCode("");
    refresh();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${enabled ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
          >
            {enabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Two-factor authentication</h2>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "Your account is protected with an authenticator app."
                : "Add an extra layer of security with a code from your authenticator app."}
            </p>
          </div>
        </div>
        {enabled && (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            Enabled
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : enabled ? (
        <div className="space-y-3">
          {verified.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {f.friendly_name || "Authenticator app"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Added {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => {
                  setDisableId(f.id);
                  setDisableCode("");
                }}
                className="text-xs font-semibold text-destructive hover:underline"
              >
                Disable
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
            <div>
              <p className="text-sm font-medium text-foreground">Recovery codes</p>
              <p className="text-[11px] text-muted-foreground">
                {codesStatus
                  ? `${codesStatus.remaining} of ${codesStatus.total} unused`
                  : "Backup codes for when you lose your authenticator."}
              </p>
            </div>
            <button
              onClick={() => {
                setRegenId(verified[0]?.id ?? null);
                setRegenCode("");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
        </div>
      ) : pending ? (
        <div className="space-y-4">
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
            <li>Open Google Authenticator, Authy, or 1Password.</li>
            <li>Scan the QR code below (or enter the secret manually).</li>
            <li>Enter the 6-digit code to finish setup.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="rounded-xl bg-white p-3 border border-border">
              {/* qr_code is an SVG data URL */}
              <img src={pending.qr} alt="2FA QR code" className="w-44 h-44" />
            </div>
            <div className="flex-1 w-full">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Secret key</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={pending.secret}
                  className="input-base font-mono text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pending.secret);
                    toast.success("Secret copied");
                  }}
                  className="px-3 rounded-xl border border-border hover:bg-secondary"
                  aria-label="Copy secret"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <form onSubmit={verifyEnroll} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                6-digit code
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="input-base tracking-[0.5em] text-center font-mono text-lg"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEnroll}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify & enable
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={startEnroll}
          disabled={enrolling}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
        >
          {enrolling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <KeyRound className="w-4 h-4" />
          )}
          Enable 2FA
        </button>
      )}

      {disableId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDisableId(null)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-display font-bold text-foreground">Disable two-factor</h3>
              <button
                onClick={() => setDisableId(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={confirmDisable} className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter a code from your authenticator app to confirm.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="input-base tracking-[0.5em] text-center font-mono text-lg"
              />
              <button
                type="submit"
                disabled={disabling}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
              >
                {disabling && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm & disable
              </button>
            </form>
          </div>
        </div>
      )}

      {regenId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setRegenId(null)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-display font-bold text-foreground">Regenerate recovery codes</h3>
              <button
                onClick={() => setRegenId(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={confirmRegenerate} className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Generating new codes will invalidate all previous recovery codes. Enter a code from
                your authenticator app to confirm.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="input-base tracking-[0.5em] text-center font-mono text-lg"
              />
              <button
                type="submit"
                disabled={regenLoading}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
              >
                {regenLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Generate new codes
              </button>
            </form>
          </div>
        </div>
      )}

      {shownCodes && <RecoveryCodesModal codes={shownCodes} onClose={() => setShownCodes(null)} />}
    </div>
  );
}
