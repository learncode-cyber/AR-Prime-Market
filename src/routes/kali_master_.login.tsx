import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { GoogleSignInButton, OrDivider } from "@/components/auth/GoogleSignInButton";

export const Route = createFileRoute("/kali_master_/login")({
  head: () => ({
    meta: [{ title: "Admin Login — Kali Master" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: KaliMasterLogin,
});

function KaliMasterLogin() {
  const { signIn, user, isAdmin, loading: authLoading, adminChecked } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && adminChecked && user && isAdmin) {
      navigate({ to: "/kali_master" });
    }
  }, [authLoading, adminChecked, user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error || "Login failed");
      return;
    }
    toast.success("Welcome back");
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="border border-border/60 rounded-2xl bg-card p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Kali Master Console</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Restricted access. Admin credentials required.
            </p>
          </div>
          <GoogleSignInButton redirectPath="/kali_master" />
          <OrDivider label="or use admin credentials" />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground py-2.5 font-medium hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in to admin"}
            </button>
            {user && adminChecked && !isAdmin && (
              <p className="text-xs text-destructive text-center mt-2">
                Signed in but no admin privileges. Contact owner.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
