import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton, OrDivider } from "@/components/auth/GoogleSignInButton";
import { FacebookSignInButton } from "@/components/auth/FacebookSignInButton";
import { fireMetaEvent } from "@/lib/metaPixel";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up — AR Prime Market" },
      { name: "description", content: "Create your AR Prime Market account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    navigate({ to: "/" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);
    if (error) toast.error(error);
    else {
      const [firstName, ...rest] = name.trim().split(/\s+/);
      fireMetaEvent(
        "CompleteRegistration",
        { status: true, content_name: "email_signup" },
        { userData: { email, first_name: firstName, last_name: rest.join(" ") || undefined } },
      );
      toast.success("Account created! Please check your email to verify.");
      navigate({ to: "/login" });
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join AR Prime Market and start shopping curated products worldwide."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-2">
        <GoogleSignInButton redirectPath="/account" label="Sign up with Google" />
        <FacebookSignInButton redirectPath="/account" label="Sign up with Facebook" />
      </div>
      <OrDivider label="or sign up with email" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Full name</span>
          <div className="relative">
            <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="input-base pl-10"
            />
          </div>
        </label>
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
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</span>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
        <p className="text-[11px] text-muted-foreground">
          By creating an account you agree to our terms and privacy policy.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
