import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton, OrDivider } from "@/components/auth/GoogleSignInButton";
import { FacebookSignInButton } from "@/components/auth/FacebookSignInButton";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — AR Prime Market" },
      { name: "description", content: "Sign in to your AR Prime Market account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  if (user && !mfa) {
    navigate({ to: "/" });
    return null;
  }

  const handleForgotPassword = async () => {
    const target = email || prompt("Enter your email address:");
    if (!target) return;
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent! Check your inbox.");
  };

  const trustedKey = (userId: string) => `mfa_trusted_device:${userId}`;

  const isDeviceTrusted = (userId: string) => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(trustedKey(userId));
      if (!raw) return false;
      const { expiresAt } = JSON.parse(raw) as { expiresAt: number };
      if (Date.now() > expiresAt) {
        localStorage.removeItem(trustedKey(userId));
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const trustThisDevice = (userId: string) => {
    if (typeof window === "undefined") return;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const token = crypto.randomUUID();
    localStorage.setItem(
      trustedKey(userId),
      JSON.stringify({ token, expiresAt: Date.now() + THIRTY_DAYS }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast.error(error);
      return;
    }

    // Check if MFA challenge is required
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (uid && totp && isDeviceTrusted(uid)) {
        // Trusted device — skip the prompt
        setLoading(false);
        toast.success("Welcome back!");
        navigate({ to: "/account" });
        return;
      }
      setLoading(false);
      if (totp) {
        setMfa({ factorId: totp.id });
        return;
      }
    }
    setLoading(false);
    toast.success("Welcome back!");
    navigate({ to: "/account" });
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfa) return;
    if (!/^\d{6}$/.test(mfaCode)) return toast.error("Enter the 6-digit code");
    setVerifyingMfa(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: mfa.factorId,
    });
    if (chalErr || !chal) {
      setVerifyingMfa(false);
      return toast.error(chalErr?.message || "Failed");
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfa.factorId,
      challengeId: chal.id,
      code: mfaCode,
    });
    setVerifyingMfa(false);
    if (error) return toast.error(error.message);
    if (rememberDevice) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.id) trustThisDevice(userData.user.id);
    }
    toast.success("Welcome back!");
    navigate({ to: "/account" });
  };

  if (mfa) {
    return (
      <AuthShell
        title="Two-factor required"
        subtitle="Enter the 6-digit code from your authenticator app to continue."
      >
        <form onSubmit={submitMfa} className="space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="input-base tracking-[0.5em] text-center font-mono text-lg"
          />
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span>Remember this device for 30 days</span>
          </label>
          <button
            type="submit"
            disabled={verifyingMfa}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {verifyingMfa && <Loader2 className="w-4 h-4 animate-spin" />}
            Verify & continue
          </button>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              setMfa(null);
              setMfaCode("");
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel and sign out
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access your orders, wishlist and saved details."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="space-y-2">
        <GoogleSignInButton redirectPath="/account" />
        <FacebookSignInButton redirectPath="/account" />
      </div>
      <OrDivider label="or sign in with email" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</span>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="input-base pl-10"
            />
          </div>
        </label>
        <label className="block">
          <span className="flex justify-between text-xs font-medium text-muted-foreground mb-1.5">
            <span>Password</span>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-primary hover:underline"
            >
              Forgot?
            </button>
          </span>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-base pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide" : "Show"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          ← Continue browsing as guest
        </Link>
      </p>
    </AuthShell>
  );
}
